import { createUser, getUserByEmail } from "../../../lib/db";
import { hashPassword, createSessionCookie } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { email, password } = req.body || {};
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: "Email and a password of at least 6 characters are required." });
  }
  const existing = await getUserByEmail(email.toLowerCase());
  if (existing) return res.status(409).json({ error: "An account with that email already exists." });

  const user = await createUser({ email: email.toLowerCase(), passwordHash: hashPassword(password) });
  res.setHeader("Set-Cookie", createSessionCookie(user.id));
  res.status(200).json({ ok: true });
}
