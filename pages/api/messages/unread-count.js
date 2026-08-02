import { getUserIdFromReq } from "../../../lib/auth";
import { unreadMessageCountForOwner } from "../../../lib/db";

export default async function handler(req, res) {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(200).json({ count: 0 });
  const count = await unreadMessageCountForOwner(userId);
  res.status(200).json({ count });
}
