import { getUserIdFromReq } from "../../../lib/auth";
import { getAccountById, createTransaction, MIN_TOKENS_PURCHASE } from "../../../lib/db";
import { stkPush } from "../../../lib/daraja";

// 1 token = 1 KES = 1 extra transaction once the free tier is used up
// (also doubles as the parole penalty buffer). Minimum MIN_TOKENS_PURCHASE.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: "Not logged in" });

    const { accountId, phone, tokens } = req.body || {};
    const amount = Number(tokens);
    if (!accountId || !phone || !amount || amount < MIN_TOKENS_PURCHASE) {
      return res.status(400).json({ error: `accountId, phone and tokens (min ${MIN_TOKENS_PURCHASE}) are required.` });
    }

    const account = await getAccountById(accountId);
    if (!account || account.user_id !== userId) return res.status(404).json({ error: "Account not found." });

    const stk = await stkPush({
      env: process.env.PLATFORM_ENV || "sandbox",
      consumerKey: process.env.PLATFORM_CONSUMER_KEY,
      consumerSecret: process.env.PLATFORM_CONSUMER_SECRET,
      shortcode: process.env.PLATFORM_SHORTCODE,
      passkey: process.env.PLATFORM_PASSKEY,
      amount,
      phone,
      callbackUrl: `${process.env.BASE_URL}/api/account/token-purchase-callback?token=${account.callback_token}`,
      accountReference: "SenditTokens",
      transactionDesc: `Purchase ${amount} tokens`,
    });

    await createTransaction({
      accountId: account.id,
      type: "token_purchase",
      checkoutRequestId: stk.CheckoutRequestID,
      merchantRequestId: stk.MerchantRequestID,
      phone,
      amount,
      accountReference: "SenditTokens",
    });

    res.status(200).json({ message: "STK prompt sent. Enter your PIN to buy tokens.", CheckoutRequestID: stk.CheckoutRequestID });
  } catch (err) {
    console.error("buy tokens failed:", err);
    res.status(502).json({ error: err.message || "Could not start the token purchase. Please try again." });
  }
}
