
import { getUserIdFromReq } from "../../../lib/auth";
import { getUserStkPushSeries } from "../../../lib/db";

const VALID_GRANULARITIES = new Set(["hourly", "daily", "monthly", "yearly"]);

export default async function handler(req, res) {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: "Please log in." });

  const granularity = VALID_GRANULARITIES.has(req.query.granularity) ? req.query.granularity : "daily";
  const series = await getUserStkPushSeries(userId, granularity);
  res.status(200).json({ granularity, series });
}
