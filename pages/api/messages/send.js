import { getUserIdFromReq } from "../../../lib/auth";
import { getUserById, getAccountById, sendMessage } from "../../../lib/db";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: "Not logged in" });

  const { accountId, body } = req.body || {};
  if (!accountId || !body || !body.trim()) {
    return res.status(400).json({ error: "accountId and a message body are required." });
  }

  const account = await getAccountById(accountId);
  if (!account) return res.status(404).json({ error: "Account not found." });

  const user = await getUserById(userId);
  const isAdmin = user?.role === "admin";
  const isOwner = account.user_id === userId;
  if (!isAdmin && !isOwner) return res.status(403).json({ error: "Not authorized for this account." });

  const message = await sendMessage({
    accountId,
    senderRole: isAdmin ? "admin" : "owner",
    senderUserId: userId,
    body: body.trim().slice(0, 2000),
  });
  res.status(200).json({ message });
}
