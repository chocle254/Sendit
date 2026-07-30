import { getUserIdFromReq } from "../../../lib/auth";
import { addWebhook, listWebhooksForUser, deleteWebhook, listAccountsForUser } from "../../../lib/db";

export default async function handler(req, res) {
  const userId = getUserIdFromReq(req);
  if (!userId) return res.status(401).json({ error: "Please log in." });

  if (req.method === "GET") {
    const webhooks = await listWebhooksForUser(userId);
    return res.status(200).json({ webhooks });
  }

  if (req.method === "POST") {
    const { accountId, url } = req.body || {};
    if (!accountId || !url) return res.status(400).json({ error: "accountId and url are required." });
    const accounts = await listAccountsForUser(userId);
    if (!accounts.find((a) => a.id === accountId)) return res.status(403).json({ error: "Not your account." });
    const webhook = await addWebhook(accountId, url);
    return res.status(200).json({ webhook });
  }

  if (req.method === "DELETE") {
    const { id } = req.body || {};
    await deleteWebhook(id, userId);
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
