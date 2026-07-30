import { getUserIdFromReq } from "../../../lib/auth";
import { createPendingAccount, createTransaction } from "../../../lib/db";
import { stkPush, normalizePhone } from "../../../lib/daraja";

const ACTIVATION_FEE = 350;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: "Please log in." });

  const { businessName, tillNumber, shortcode, consumerKey, consumerSecret, passkey, activationPhone } = req.body || {};
  if (!businessName || !tillNumber || !shortcode || !consumerKey || !consumerSecret || !passkey || !activationPhone) {
    return res.status(400).json({ error: "All fields are required." });
  }

  // 1. Create the account in pending_payment state
  const account = await createPendingAccount({
    userId, businessName, tillNumber, shortcode, consumerKey, consumerSecret, passkey,
  });

  // 2. Trigger the KES 350 activation-fee STK push using the PLATFORM's own Daraja credentials
  try {
    const phone = normalizePhone(activationPhone);
    const stk = await stkPush({
      env: process.env.PLATFORM_ENV || "sandbox",
      consumerKey: process.env.PLATFORM_CONSUMER_KEY,
      consumerSecret: process.env.PLATFORM_CONSUMER_SECRET,
      shortcode: process.env.PLATFORM_SHORTCODE,
      passkey: process.env.PLATFORM_PASSKEY,
      amount: ACTIVATION_FEE,
      phone,
      callbackUrl: `${process.env.BASE_URL}/api/account/activation-callback`,
      accountReference: "Activation",
      transactionDesc: `Activation fee for ${businessName}`,
    });

    await createTransaction({
      accountId: account.id,
      type: "activation",
      checkoutRequestId: stk.CheckoutRequestID,
      merchantRequestId: stk.MerchantRequestID,
      phone,
      amount: ACTIVATION_FEE,
      accountReference: "Activation",
    });

    res.status(200).json({
      ok: true,
      accountId: account.id,
      message: "Check your phone and enter your M-Pesa PIN to complete the KES 350 activation payment.",
    });
  } catch (err) {
    res.status(502).json({ error: `Could not start the activation payment: ${err.message}` });
  }
}
