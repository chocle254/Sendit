import { getUserIdFromReq } from "../../../lib/auth";
import { requireAdmin, getAdminRevenueSeries } from "../../../lib/db";

const VALID_GRANULARITIES = new Set(["hourly", "daily", "monthly", "yearly"]);

export default async function handler(req, res) {
  const admin = await requireAdmin(getUserIdFromReq(req));
  if (!admin) return res.status(403).json({ error: "Admin access required." });

  const granularity = VALID_GRANULARITIES.has(req.query.granularity) ? req.query.granularity : "daily";
  const series = await getAdminRevenueSeries(granularity);
  res.status(200).json({ granularity, series });
}
