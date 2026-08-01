import { parsePayoutResult } from "../../../../lib/darajaPayout";
import {
  getAccountById,
  getTransactionByPayoutConversationId,
  completePayout,
  listWebhooksForAccount,
} from "../../../../lib/db";
import crypto from "crypto";

// Safaricom posts here (both as ResultURL and QueueTimeOutURL) once the B2C
// or B2B payout that followed a successful STK collection resolves. This is
// separate from /api/v1/callback/[accountId].js (the STK collection
// callback) because the payload shape and timing are both different — a
// collection can succeed while its payout is still pending, fails to start,
// or fails after starting, and developers need to know which.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { accountId, token } = req.query;
    const result = parsePayoutResult(req.body);
    if (!result) return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    const account = await getAccountById(accountId);
    if (!account || !token || !timingSafeStringEqual(token, account.callback_token)) {
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const txn = await getTransactionByPayoutConversationId(result.conversationId);
    if (!txn || String(txn.account_id) !== String(account.id)) {
      return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    await completePayout({
      conversationId: result.conversationId,
      status: result.success ? "success" : "failed",
      receipt: result.receipt,
      resultDesc: result.resultDesc,
    });

    const webhooks = await listWebhooksForAccount(account.id);
    const payload = {
      event: "payout",
      checkout_request_id: txn.checkout_request_id,
      payout_status: result.success ? "success" : "failed",
      payout_receipt: result.receipt,
      fee_amount: txn.fee_amount,
      net_amount: txn.net_amount,
    };
    await Promise.allSettled(
      webhooks.map((w) =>
        fetch(w.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      )
    );

    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    console.error("payout callback failed:", err);
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b || ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
