import { getUserIdFromReq } from "../../../lib/auth";
import { createTrialAccount, FREE_TX_LIMIT } from "../../../lib/db";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: "Not logged in" });

    const { businessName, accountType, payoutPhone, tillNumber, paybillNumber, paybillAccountNumber, detailsConfirmed } = req.body || {};

    if (!businessName || !accountType) {
      return res.status(400).json({ error: "Business name and account type are required." });
    }
    if (!["phone", "till", "paybill"].includes(accountType)) {
      return res.status(400).json({ error: "accountType must be 'phone', 'till', or 'paybill'." });
    }
    if (accountType === "phone" && !payoutPhone) {
      return res.status(400).json({ error: "Payout phone number is required." });
    }
    if (accountType === "till" && !tillNumber) {
      return res.status(400).json({ error: "Till number is required." });
    }
    if (accountType === "paybill" && (!paybillNumber || !paybillAccountNumber)) {
      return res.status(400).json({ error: "Paybill number and account number are required." });
    }
    // Client-side confirmation is a UX nudge; this check is what actually
    // matters. Sendit cannot issue refunds for payments sent to a wrong
    // till/paybill/account number a developer entered themselves, so we
    // require — and record — an explicit acknowledgment before linking.
    if (detailsConfirmed !== true) {
      return res.status(400).json({ error: "You must confirm these details are correct before linking." });
    }

    const account = await createTrialAccount({
      userId,
      businessName,
      accountType,
      payoutPhone: accountType === "phone" ? payoutPhone : null,
      tillNumber: accountType === "till" ? tillNumber : null,
      paybillNumber: accountType === "paybill" ? paybillNumber : null,
      paybillAccountNumber: accountType === "paybill" ? paybillAccountNumber : null,
      detailsConfirmed: true,
    });

    const gotFreeTier = (account.free_tx_used ?? 0) === 0;
    res.status(200).json({
      account,
      message: gotFreeTier
        ? `Account linked. You have ${FREE_TX_LIMIT} free transactions, then you'll need to subscribe or buy tokens.`
        : "Account linked. Your free tier was already used on an earlier account, so this account needs a subscription or purchased tokens before it can send STK pushes.",
    });
  } catch (err) {
    console.error("link account failed:", err);
    res.status(500).json({ error: "Something went wrong linking your account. Please try again." });
  }
}
