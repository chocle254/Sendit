import { parseStkCallback } from "../../../../lib/daraja";
import { getSecurityCredential, b2cPayout, b2bPayout } from "../../../../lib/darajaPayout";
import {
  getTransactionByCheckoutId,
  completeTransaction,
  listWebhooksForAccount,
  getAccountById,
  recordSuccess,
  recordFailure,
  recordPayoutInitiated,
  markPayoutFailedToStart,
} from "../../../../lib/db";
import crypto from "crypto";

// Fires the payout leg (B2C to a phone, or B2B to a till/paybill) right after
// a collection succeeds. Deducts Sendit's fee_bps first. Never throws —
// a payout that fails to even start is recorded as payout_status='failed'
// and left for manual/admin retry rather than blocking the STK response.
async function triggerPayout({ account, txn }) {
  const grossAmount = Number(txn.amount);
  const feeAmount = Math.round((grossAmount * (account.fee_bps || 0)) / 100) / 100;
  const netAmount = Math.round((grossAmount - feeAmount) * 100) / 100;

  try {
    const env = process.env.PLATFORM_ENV || "sandbox";
    const securityCredential = getSecurityCredential({
      initiatorPassword: process.env.PLATFORM_INITIATOR_PASSWORD,
      certPath: process.env.PLATFORM_CERT_PATH,
    });
    const resultUrl = `${process.env.BASE_URL}/api/v1/payout-callback/${account.id}?token=${account.callback_token}`;
    const timeoutUrl = resultUrl;

    let payoutRes;
    if (account.account_type === "phone") {
      payoutRes = await b2cPayout({
        env,
        consumerKey: process.env.PLATFORM_CONSUMER_KEY,
        consumerSecret: process.env.PLATFORM_CONSUMER_SECRET,
        shortcode: process.env.PLATFORM_SHORTCODE,
        initiatorName: process.env.PLATFORM_INITIATOR_NAME,
        securityCredential,
        amount: netAmount,
        phone: account.payout_phone,
        remarks: `Sendit payout ${txn.account_reference || ""}`.slice(0, 100),
        resultUrl,
        timeoutUrl,
      });
    } else {
      const isPaybill = account.account_type === "paybill";
      payoutRes = await b2bPayout({
        env,
        consumerKey: process.env.PLATFORM_CONSUMER_KEY,
        consumerSecret: process.env.PLATFORM_CONSUMER_SECRET,
        shortcode: process.env.PLATFORM_SHORTCODE,
        initiatorName: process.env.PLATFORM_INITIATOR_NAME,
        securityCredential,
        amount: netAmount,
        partyB: isPaybill ? account.paybill_number : account.till_number,
        accountReference: account.paybill_account_number,
        remarks: `Sendit payout ${txn.account_reference || ""}`.slice(0, 100),
        resultUrl,
        timeoutUrl,
        isPaybill,
      });
    }

    await recordPayoutInitiated({
      transactionId: txn.id,
      feeAmount,
      netAmount,
      payoutConversationId: payoutRes.ConversationID,
    });
  } catch (err) {
    console.error("payout failed to start:", err);
    await markPayoutFailedToStart({ transactionId: txn.id, resultDesc: err.message || "Payout failed to start." });
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { accountId, token } = req.query;
    const result = parseStkCallback(req.body);
    if (!result) return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    const account = await getAccountById(accountId);
    if (!account || !token || !timingSafeStringEqual(token, account.callback_token)) {
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const txn = await getTransactionByCheckoutId(result.checkoutRequestId);
    if (!txn || txn.type !== "stkpush" || String(txn.account_id) !== String(account.id)) {
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    await completeTransaction({
      checkoutRequestId: result.checkoutRequestId,
      status: result.success ? "success" : "failed",
      mpesaReceipt: result.mpesaReceipt,
      resultDesc: result.resultDesc,
    });

    if (result.success) {
      await recordSuccess(account.id);
      // Fire-and-forget from Safaricom's perspective, but awaited here so any
      // failure-to-start is recorded before we return — the payout itself
      // resolves later via the async payout-callback endpoint.
      await triggerPayout({ account, txn: { ...txn, amount: txn.amount } });
    } else {
      await recordFailure(account.id, txn.id);
    }

    const webhooks = await listWebhooksForAccount(account.id);
    const payload = {
      ResponseCode: result.success ? 0 : result.resultCode,
      ResponseDescription: result.resultDesc,
      MerchantRequestID: result.merchantRequestId,
      CheckoutRequestID: result.checkoutRequestId,
      MpesaReceiptNumber: result.mpesaReceipt,
      Amount: result.amount,
      PhoneNumber: result.phone,
    };

    await Promise.allSettled(
      webhooks.map((w) =>
        fetch(w.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      )
    );

    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    console.error("stk callback failed:", err);
    // Always 200 to Safaricom even on our own error, or they'll retry aggressively.
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b || ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
