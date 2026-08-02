
import { getUserIdFromReq } from "../../../lib/auth";
import { markNotificationsRead } from "../../../lib/db";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: "Not logged in" });

  await markNotificationsRead(userId);
  res.status(200).json({ ok: true });
}
