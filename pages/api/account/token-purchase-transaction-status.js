import { getUserIdFromReq } from "../../../lib/auth";
import { getAccountById, getTransactionByCheckoutId, completeTransaction, creditTokens } from "../../../lib/db";
import { stkPushQuery, mapQueryStatus } from "../../../lib/daraja";

// GET /api/account/token-purchase-transaction-status?checkoutRequestId=...
// Same "poll it directly" fallback, applied to token purchases.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: "Not logged in" });

    const { checkoutRequestId } = req.query;
    if (!checkoutRequestId) return res.status(400).json({ error: "checkoutRequestId is required." });

    const txn = await getTransactionByCheckoutId(checkoutRequestId);
    if (!txn || txn.type !== "token_purchase") return res.status(404).json({ error: "Transaction not found." });

    const account = await getAccountById(txn.account_id);
    if (!account || account.user_id !== userId) return res.status(404).json({ error: "Account not found." });

    if (txn.status === "success" || txn.status === "failed") {
      return res.status(200).json({ status: txn.status });
    }

    if (!process.env.PLATFORM_CONSUMER_KEY || !process.env.PLATFORM_CONSUMER_SECRET || !process.env.PLATFORM_SHORTCODE || !process.env.PLATFORM_PASSKEY) {
      return res.status(500).json({ error: "Payment provider not configured." });
    }

    const data = await stkPushQuery({
      env: process.env.PLATFORM_ENV || "sandbox",
      consumerKey: process.env.PLATFORM_CONSUMER_KEY,
      consumerSecret: process.env.PLATFORM_CONSUMER_SECRET,
      shortcode: process.env.PLATFORM_SHORTCODE,
      passkey: process.env.PLATFORM_PASSKEY,
      checkoutRequestId,
    });

    const status = mapQueryStatus(data);
    if (status === "pending") return res.status(200).json({ status: "pending" });

    await completeTransaction({
      checkoutRequestId,
      status,
      mpesaReceipt: txn.mpesa_receipt || null,
      resultDesc: data.ResultDesc || (status === "success" ? "Completed" : "Failed or cancelled"),
    });

    if (status === "success") {
      await creditTokens(account.id, txn.amount, "purchase", txn.id);
    }

    res.status(200).json({ status });
  } catch (err) {
    console.error("token purchase status check failed:", err);
    res.status(200).json({ status: "pending" });
  }
}
