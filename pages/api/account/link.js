import { getUserIdFromReq } from "../../../lib/auth";
import { createTrialAccount } from "../../../lib/db";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: "Not logged in" });

    const { businessName, accountType, tillNumber, paybillNumber, paybillAccountNumber } = req.body || {};

    if (!businessName || !accountType) {
      return res.status(400).json({ error: "Business name and account type are required." });
    }
    if (accountType === "till" && !tillNumber) {
      return res.status(400).json({ error: "Till number is required." });
    }
    if (accountType === "paybill" && (!paybillNumber || !paybillAccountNumber)) {
      return res.status(400).json({ error: "Paybill number and account number are required." });
    }
    if (accountType !== "till" && accountType !== "paybill") {
      return res.status(400).json({ error: "accountType must be 'till' or 'paybill'." });
    }

    const account = await createTrialAccount({
      userId,
      businessName,
      accountType,
      tillNumber: accountType === "till" ? tillNumber : null,
      paybillNumber: accountType === "paybill" ? paybillNumber : null,
      paybillAccountNumber: accountType === "paybill" ? paybillAccountNumber : null,
    });

    res.status(200).json({
      account,
      message: "Account linked. You have 25 free transactions before you'll need to pay KES 350 to reset.",
    });
  } catch (err) {
    console.error("link account failed:", err);
    res.status(500).json({ error: "Something went wrong linking your account. Please try again." });
  }
}
