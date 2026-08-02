import { getUserIdFromReq } from "../../../lib/auth";
import { requireAdmin, getAdminOverviewStats } from "../../../lib/db";

export default async function handler(req, res) {
  const admin = await requireAdmin(getUserIdFromReq(req));
  if (!admin) return res.status(403).json({ error: "Admin access required." });

  const stats = await getAdminOverviewStats();
  res.status(200).json(stats);
}
