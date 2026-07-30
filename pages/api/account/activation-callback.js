import { parseStkCallback } from "../../../lib/daraja";
import { getTransactionByCheckoutId, completeTransaction, activateAccount, markAccountFailed } from "../../../lib/db";
import { generateApiKey } from "../../../lib/auth";

// Safaricom calls this URL directly. It is NOT authenticated by a session cookie —
// validate by matching the CheckoutRequestID we stored when we started the push.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const result = parseStkCallback(req.body);
  // Always acknowledge Safaricom so it stops retrying, even if something below fails.
  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

  if (!result) return;
  const txn = await getTransactionByCheckoutId(result.checkoutRequestId);
  if (!txn) return;

  await completeTransaction({
    checkoutRequestId: result.checkoutRequestId,
    status: result.success ? "success" : "failed",
    mpesaReceipt: result.mpesaReceipt,
    resultDesc: result.resultDesc,
  });

  if (result.success) {
    await activateAccount(txn.account_id, generateApiKey());
  } else {
    await markAccountFailed(txn.account_id);
  }
}
