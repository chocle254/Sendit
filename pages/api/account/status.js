import { getUserIdFromReq } from "../../../lib/auth";
import { getAccountById } from "../../../lib/db";

// Lightweight polling endpoint the "Link Account" page uses while waiting
// for the activation-fee STK push to complete.
export default async function handler(req, res) {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: "Please log in." });
  const { id } = req.query;
  const account = await getAccountById(id);
  if (!account || account.user_id !== userId) return res.status(404).json({ error: "Not found" });
  res.status(200).json({ status: account.status, apiKey: account.api_key });
}
