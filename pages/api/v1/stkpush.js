import { getAccountByApiKey, createTransaction, incrementFreeUsage, consumeTransactionToken, evaluateAccountUsage } from "../../../lib/db";
import { stkPush, normalizePhone } from "../../../lib/daraja";

// Same timeout issue as buy-tokens.js / subscribe.js / activate.js, but
// this endpoint matters even more — it's the one every downstream app
// (like camp) calls for real customer payments, so a dropped connection
// here risks a contributor being double-charged if the caller retries.
export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const authHeader = req.headers.authorization || "";
    const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!apiKey) return res.status(401).json({ error: "Missing Authorization: Bearer <api_key> header." });

    const account = await getAccountByApiKey(apiKey);
    if (!account) return res.status(401).json({ error: "Invalid API key." });

    const usage = evaluateAccountUsage(account);
    if (!usage.allowed) return res.status(402).json({ error: usage.reason });

    const { phone, amount, account_reference, transaction_desc } = req.body || {};
    if (!phone || !amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: "phone and a positive numeric amount are required." });
    }

    const isPaybill = account.account_type === "paybill";
    const partyB = isPaybill ? account.paybill_number : account.till_number;
    const accountReference = isPaybill
      ? (account.paybill_account_number || account_reference || account.business_name)
      : (account_reference || account.business_name);

    const normalizedPhone = normalizePhone(phone);
    const stk = await stkPush({
      env: process.env.PLATFORM_ENV || "sandbox",
      consumerKey: process.env.PLATFORM_CONSUMER_KEY,
      consumerSecret: process.env.PLATFORM_CONSUMER_SECRET,
      shortcode: process.env.PLATFORM_SHORTCODE,
      passkey: process.env.PLATFORM_PASSKEY,
      partyB,
      transactionType: isPaybill ? "CustomerPayBillOnline" : "CustomerBuyGoodsOnline",
      amount,
      phone: normalizedPhone,
      callbackUrl: `${process.env.BASE_URL}/api/v1/callback/${account.id}?token=${account.callback_token}`,
      accountReference,
      transactionDesc: transaction_desc || "Payment",
    });

    await createTransaction({
      accountId: account.id,
      type: "stkpush",
      checkoutRequestId: stk.CheckoutRequestID,
      merchantRequestId: stk.MerchantRequestID,
      phone: normalizedPhone,
      amount,
      accountReference,
    });

    // An active plan is unlimited (nothing to decrement); otherwise this
    // transaction drew from the free tier or a purchased token.
    if (usage.bucket === "free") {
      await incrementFreeUsage(account.id);
    } else if (usage.bucket === "token") {
      await consumeTransactionToken(account.id);
    }

    res.status(200).json({
      ResponseCode: "0",
      ResponseDescription: "Success. Request accepted for processing.",
      MerchantRequestID: stk.MerchantRequestID,
      CheckoutRequestID: stk.CheckoutRequestID,
    });
  } catch (err) {
    console.error("stkpush failed:", err);
    res.status(502).json({ error: err.message || "STK push failed." });
  }
}
