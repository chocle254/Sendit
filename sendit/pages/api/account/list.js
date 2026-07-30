import { getUserIdFromReq } from "../../../lib/auth";
import { listAccountsForUser } from "../../../lib/db";

export default async function handler(req, res) {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: "Please log in." });
  const accounts = await listAccountsForUser(userId);
  res.status(200).json({ accounts });
}
