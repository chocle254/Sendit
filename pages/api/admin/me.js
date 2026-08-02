import { getUserIdFromReq } from "../../../lib/auth";
import { requireAdmin } from "../../../lib/db";

export default async function handler(req, res) {
  const admin = await requireAdmin(getUserIdFromReq(req));
  res.status(200).json({ admin });
}
