import { getAccountByApiKey, createTransaction } from "../../../lib/db";
import { stkPush, normalizePhone } from "../../../lib/daraja";

// Public API for developers who have linked and activated an account.
// Auth: Authorization: Bearer <api_key>
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const authHeader = req.headers.authorization || "";
  const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!apiKey) return res.status(401).json({ error: "Missing Authorization: Bearer <api_key> header." });

  const account = await getAccountByApiKey(apiKey);
  if (!account) return res.status(401).json({ error: "Invalid or inactive API key." });

  const { phone, amount, account_reference, transaction_desc } = req.body || {};
  if (!phone || !amount) return res.status(400).json({ error: "phone and amount are required." });

  try {
    const normalizedPhone = normalizePhone(phone);
    const stk = await stkPush({
      env: process.env.PLATFORM_ENV || "sandbox",
      consumerKey: account.consumer_key,
      consumerSecret: account.consumer_secret,
      shortcode: account.shortcode,
      passkey: account.passkey,
      amount,
      phone: normalizedPhone,
      callbackUrl: `${process.env.BASE_URL}/api/v1/callback/${account.id}`,
      accountReference: account_reference || account.business_name,
      transactionDesc: transaction_desc || "Payment",
    });

    await createTransaction({
      accountId: account.id,
      type: "stkpush",
      checkoutRequestId: stk.CheckoutRequestID,
      merchantRequestId: stk.MerchantRequestID,
      phone: normalizedPhone,
      amount,
      accountReference: account_reference || account.business_name,
    });

    res.status(200).json({
      ResponseCode: "0",
      ResponseDescription: "Success. Request accepted for processing.",
      MerchantRequestID: stk.MerchantRequestID,
      CheckoutRequestID: stk.CheckoutRequestID,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
