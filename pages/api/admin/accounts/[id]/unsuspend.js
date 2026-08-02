import { getUserIdFromReq } from "../../../../../lib/auth";
import { requireAdmin, unsuspendAccount, getAccountById } from "../../../../../lib/db";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const admin = await requireAdmin(getUserIdFromReq(req));
  if (!admin) return res.status(403).json({ error: "Admin access required." });

  const { id } = req.query;
  const account = await getAccountById(id);
  if (!account) return res.status(404).json({ error: "Account not found." });

  const { note } = req.body || {};
  await unsuspendAccount(id, admin.id, note);
  res.status(200).json({ ok: true });
}
