import { getUserIdFromReq } from "../../../lib/auth";
import { getAccountById, createTransaction, PLAN_PRICES_KES } from "../../../lib/db";
import { stkPush } from "../../../lib/daraja";

// See buy-tokens.js for why this matters: two sequential external calls to
// Safaricom can exceed Vercel's default timeout and drop the connection
// after the charge already succeeded server-side.
export const maxDuration = 30;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: "Not logged in" });

    const { accountId, phone, plan } = req.body || {};
    if (!accountId || !phone || !["monthly", "yearly"].includes(plan)) {
      return res.status(400).json({ error: "accountId, phone, and plan ('monthly' or 'yearly') are required." });
    }

    const account = await getAccountById(accountId);
    if (!account || account.user_id !== userId) return res.status(404).json({ error: "Account not found." });

    const amount = PLAN_PRICES_KES[plan];
    const stk = await stkPush({
      env: process.env.PLATFORM_ENV || "sandbox",
      consumerKey: process.env.PLATFORM_CONSUMER_KEY,
      consumerSecret: process.env.PLATFORM_CONSUMER_SECRET,
      shortcode: process.env.PLATFORM_SHORTCODE,
      passkey: process.env.PLATFORM_PASSKEY,
      amount,
      phone,
      callbackUrl: `${process.env.BASE_URL}/api/account/subscription-callback?token=${account.callback_token}`,
      accountReference: `SenditPlan:${plan}`,
      transactionDesc: `Sendit ${plan} plan`,
    });

    await createTransaction({
      accountId: account.id,
      type: "subscription",
      checkoutRequestId: stk.CheckoutRequestID,
      merchantRequestId: stk.MerchantRequestID,
      phone,
      amount,
      accountReference: `SenditPlan:${plan}`,
    });

    res.status(200).json({ message: "STK prompt sent. Enter your PIN to activate the plan.", CheckoutRequestID: stk.CheckoutRequestID });
  } catch (err) {
    console.error("subscribe failed:", err);
    res.status(502).json({ error: err.message || "Could not start the subscription payment. Please try again." });
  }
}
