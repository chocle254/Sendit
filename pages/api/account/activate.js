import { getUserIdFromReq } from "../../../lib/auth";
import { getAccountById, createTransaction } from "../../../lib/db";
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

    const { accountId, phone } = req.body || {};
    if (!accountId || !phone) return res.status(400).json({ error: "accountId and phone are required." });

    const account = await getAccountById(accountId);
    if (!account || account.user_id !== userId) return res.status(404).json({ error: "Account not found." });

    const stk = await stkPush({
      env: process.env.PLATFORM_ENV || "sandbox",
      consumerKey: process.env.PLATFORM_CONSUMER_KEY,
      consumerSecret: process.env.PLATFORM_CONSUMER_SECRET,
      shortcode: process.env.PLATFORM_SHORTCODE,
      passkey: process.env.PLATFORM_PASSKEY,
      amount: 350,
      phone,
      callbackUrl: `${process.env.BASE_URL}/api/account/activation-callback?token=${account.callback_token}`,
      accountReference: "SenditActivation",
      transactionDesc: "Sendit activation fee",
    });

    await createTransaction({
      accountId: account.id,
      type: "activation",
      checkoutRequestId: stk.CheckoutRequestID,
      merchantRequestId: stk.MerchantRequestID,
      phone,
      amount: 350,
      accountReference: "SenditActivation",
    });

    res.status(200).json({ message: "STK prompt sent. Enter your PIN to activate.", CheckoutRequestID: stk.CheckoutRequestID });
  } catch (err) {
    console.error("activate failed:", err);
    res.status(502).json({ error: err.message || "Could not start the activation payment. Please try again." });
  }
}
