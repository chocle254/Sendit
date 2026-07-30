import { getUserIdFromReq } from "../../../lib/auth";
import { listAccountsForUser } from "../../../lib/db";

export default async function handler(req, res) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) return res.status(401).json({ error: "Please log in." });
    const accounts = await listAccountsForUser(userId);
    res.status(200).json({ accounts });
  } catch (err) {
    console.error("list accounts failed:", err);
    res.status(500).json({ error: "Could not load your accounts. Please try again." });
  }
}
