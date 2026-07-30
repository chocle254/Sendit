import { liftParole, getAccountById } from "../../lib/db";
import crypto from "crypto";

// Minimal shared-secret gate — swap for a real admin login before this
// handles significant real-money volume.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const provided = req.headers["x-admin-secret"] || "";
  const expected = process.env.ADMIN_SECRET || "";
  if (!expected || !timingSafeStringEqual(provided, expected)) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const { accountId, note } = req.body || {};
  if (!accountId) return res.status(400).json({ error: "accountId is required." });

  const account = await getAccountById(accountId);
  if (!account) return res.status(404).json({ error: "Account not found." });

  await liftParole(accountId, note);
  res.status(200).json({ message: `Parole lifted for account ${accountId}.` });
}

function timingSafeStringEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
