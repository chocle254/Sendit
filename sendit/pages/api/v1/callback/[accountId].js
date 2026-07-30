import { parseStkCallback } from "../../../../lib/daraja";
import {
  getTransactionByCheckoutId,
  completeTransaction,
  listWebhooksForAccount,
  getAccountById,
  recordSuccess,
  recordFailure,
} from "../../../../lib/db";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

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
}

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b || ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
