import { getUserIdFromReq } from "../../../lib/auth";
import { createTrialAccount } from "../../../lib/db";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: "Not logged in" });

  const { businessName, tillNumber, shortcode, consumerKey, consumerSecret, passkey } = req.body || {};
  if (!businessName || !tillNumber || !shortcode || !consumerKey || !consumerSecret || !passkey) {
    return res.status(400).json({ error: "All fields are required." });
  }

  const account = await createTrialAccount({
    userId, businessName, tillNumber, shortcode, consumerKey, consumerSecret, passkey,
  });

  res.status(200).json({
    account,
    message: "Account linked. You have 25 free transactions before activation (KES 350) is required.",
  });
}
