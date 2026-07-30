import { getAccountByApiKey, getTransactionByCheckoutId, completeTransaction, recordSuccess, recordFailure, listWebhooksForAccount } from "../../../lib/db";
import { stkPushQuery, mapQueryStatus } from "../../../lib/daraja";

// GET /api/v1/status?checkout_request_id=... with Authorization: Bearer <api_key>
//
// This is the "poll it directly" endpoint from the Paywave Express pattern
// you shared — but backed by Daraja's real STK Push Query API rather than
// a second provider. The callback at /api/v1/callback/[accountId].js is
// still the primary, trusted path (Daraja's callback IS verifiable via our
// callback_token, unlike Paywave Express's), and usually resolves the
// transaction first. This endpoint exists for the same reason Paywave
// Express's did: callbacks can be delayed, dropped, or arrive after a
// serverless function has already returned — so a developer polling this
// URL gets an authoritative answer on demand instead of only waiting.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const authHeader = req.headers.authorization || "";
    const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!apiKey) return res.status(401).json({ error: "Missing Authorization: Bearer <api_key> header." });

    const account = await getAccountByApiKey(apiKey);
    if (!account) return res.status(401).json({ error: "Invalid API key." });

    const { checkout_request_id } = req.query;
    if (!checkout_request_id) return res.status(400).json({ error: "Missing checkout_request_id." });

    const txn = await getTransactionByCheckoutId(checkout_request_id);
    if (!txn || txn.type !== "stkpush" || String(txn.account_id) !== String(account.id)) {
      return res.status(404).json({ error: "Transaction not found." });
    }

    // Already resolved — most likely the callback already landed. Return
    // the stored result rather than re-querying Safaricom.
    if (txn.status === "success" || txn.status === "failed") {
      return res.status(200).json({
        status: txn.status,
        receipt: txn.mpesa_receipt,
        amount: txn.amount,
      });
    }

    if (!process.env.PLATFORM_CONSUMER_KEY || !process.env.PLATFORM_CONSUMER_SECRET || !process.env.PLATFORM_SHORTCODE || !process.env.PLATFORM_PASSKEY) {
      console.error("Missing PLATFORM_* Daraja environment variables");
      return res.status(500).json({ error: "Payment provider not configured." });
    }

    const data = await stkPushQuery({
      env: process.env.PLATFORM_ENV || "sandbox",
      consumerKey: process.env.PLATFORM_CONSUMER_KEY,
      consumerSecret: process.env.PLATFORM_CONSUMER_SECRET,
      shortcode: process.env.PLATFORM_SHORTCODE,
      passkey: process.env.PLATFORM_PASSKEY,
      checkoutRequestId: checkout_request_id,
    });

    const status = mapQueryStatus(data);
    if (status === "pending") {
      return res.status(200).json({ status: "pending" });
    }

    // The query API confirms success/failure but doesn't return the M-Pesa
    // receipt (that only ever comes via the callback's CallbackMetadata).
    // If the callback hasn't landed yet, we finalize status now and let the
    // callback fill in the receipt later if/when it arrives (completeTransaction
    // is safe to call again with the same status).
    await completeTransaction({
      checkoutRequestId: checkout_request_id,
      status,
      mpesaReceipt: txn.mpesa_receipt || null,
      resultDesc: data.ResultDesc || (status === "success" ? "Completed" : "Failed or cancelled"),
    });

    if (status === "success") {
      await recordSuccess(account.id);
    } else {
      await recordFailure(account.id, txn.id);
    }

    const webhooks = await listWebhooksForAccount(account.id);
    const payload = {
      status,
      checkout_request_id,
      amount: txn.amount,
      phone: txn.phone,
    };
    await Promise.allSettled(
      webhooks.map((w) =>
        fetch(w.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      )
    );

    res.status(200).json({ status, amount: txn.amount });
  } catch (err) {
    console.error("status check failed:", err);
    res.status(200).json({ status: "pending" });
  }
}
