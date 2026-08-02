import { getUserIdFromReq } from "../../../../lib/auth";
import { requireAdmin, getAccountActivityForAdmin } from "../../../../lib/db";

export default async function handler(req, res) {
  const admin = await requireAdmin(getUserIdFromReq(req));
  if (!admin) return res.status(403).json({ error: "Admin access required." });

  const { id } = req.query;
  const data = await getAccountActivityForAdmin(id);
  if (!data) return res.status(404).json({ error: "Account not found." });
  res.status(200).json(data);
}
