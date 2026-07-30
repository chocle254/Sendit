import { getUserIdFromReq } from "../../../lib/auth";
import { getUserById } from "../../../lib/db";

export default async function handler(req, res) {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(200).json({ user: null });
  const user = await getUserById(userId);
  res.status(200).json({ user });
}
