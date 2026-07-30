import { parseStkCallback } from "../../../../lib/daraja";
import { getTransactionByCheckoutId, completeTransaction, listWebhooksForAccount } from "../../../../lib/db";

// Safaricom posts here for every STK push a developer's linked account triggers.
// We update our own record, then forward the same payload to any webhook URLs
// the developer has registered for this account.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

  const { accountId } = req.query;
  const result = parseStkCallback(req.body);
  if (!result) return;

  const txn = await getTransactionByCheckoutId(result.checkoutRequestId);
  if (!txn) return;

  await completeTransaction({
    checkoutRequestId: result.checkoutRequestId,
    status: result.success ? "success" : "failed",
    mpesaReceipt: result.mpesaReceipt,
    resultDesc: result.resultDesc,
  });

  const webhooks = await listWebhooksForAccount(accountId);
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
}
