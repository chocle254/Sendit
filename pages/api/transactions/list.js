import { getUserIdFromReq } from "../../../lib/auth";
import { listTransactionsForUser, transactionStatsForUser } from "../../../lib/db";

export default async function handler(req, res) {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: "Please log in." });
  const [transactions, stats] = await Promise.all([
    listTransactionsForUser(userId),
    transactionStatsForUser(userId),
  ]);
  res.status(200).json({ transactions, stats });
}
