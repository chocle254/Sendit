import { getUserIdFromReq } from "../../../../lib/auth";
import { requireAdmin, listAllAccountsForAdmin } from "../../../../lib/db";

export default async function handler(req, res) {
  const admin = await requireAdmin(getUserIdFromReq(req));
  if (!admin) return res.status(403).json({ error: "Admin access required." });

  const accounts = await listAllAccountsForAdmin();
  res.status(200).json({ accounts });
}
