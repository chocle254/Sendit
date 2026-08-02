import { getUserIdFromReq } from "../../../lib/auth";
import { getAccountById, getTransactionByCheckoutId, completeTransaction, startOrExtendPlan } from "../../../lib/db";
import { stkPushQuery, mapQueryStatus } from "../../../lib/daraja";

// GET /api/account/subscription-transaction-status?checkoutRequestId=...
// Same "poll it directly" fallback as token-purchase-transaction-status.js,
// applied to monthly/yearly subscriptions. Used when Safaricom's async
// callback to subscription-callback.js is delayed, dropped, or blocked
// (e.g. deployment protection on the callback URL) — without this, a
// subscription transaction can sit at 'pending' forever even though the
// payment actually went through or was cancelled on the phone.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: "Not logged in" });

    const { checkoutRequestId } = req.query;
    if (!checkoutRequestId) return res.status(400).json({ error: "checkoutRequestId is required." });

    const txn = await getTransactionByCheckoutId(checkoutRequestId);
    if (!txn || txn.type !== "subscription") return res.status(404).json({ error: "Transaction not found." });

    const account = await getAccountById(txn.account_id);
    if (!account || account.user_id !== userId) return res.status(404).json({ error: "Account not found." });

    if (txn.status === "success" || txn.status === "failed" || txn.status === "cancelled") {
      return res.status(200).json({ status: txn.status, resultDesc: txn.result_desc });
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

    const resultDesc = data.ResultDesc || (status === "success" ? "Completed" : status === "cancelled" ? "Cancelled by user" : "Failed");
    await completeTransaction({
      checkoutRequestId,
      status,
      mpesaReceipt: txn.mpesa_receipt || null,
      resultDesc,
    });

    if (status === "success") {
      // account_reference was set as "SenditPlan:monthly" / "SenditPlan:yearly" at checkout time.
      const planType = (txn.account_reference || "").split(":")[1];
      if (planType) await startOrExtendPlan(account.id, planType);
    }

    res.status(200).json({ status, resultDesc });
  } catch (err) {
    console.error("subscription status check failed:", err);
    res.status(200).json({ status: "pending" });
  }
}
