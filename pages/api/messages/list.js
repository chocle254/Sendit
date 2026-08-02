import { getUserIdFromReq } from "../../../lib/auth";
import { getUserById, getAccountById, listMessages, markMessagesRead } from "../../../lib/db";

export default async function handler(req, res) {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: "Not logged in" });

  const { accountId } = req.query;
  if (!accountId) return res.status(400).json({ error: "accountId is required." });

  const account = await getAccountById(accountId);
  if (!account) return res.status(404).json({ error: "Account not found." });

  const user = await getUserById(userId);
  const isAdmin = user?.role === "admin";
  const isOwner = account.user_id === userId;
  if (!isAdmin && !isOwner) return res.status(403).json({ error: "Not authorized for this account." });

  await markMessagesRead(accountId, isAdmin ? "admin" : "owner");
  const messages = await listMessages(accountId);
  res.status(200).json({ messages });
}
