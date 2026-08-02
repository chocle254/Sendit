import { createUser, getUserByEmail } from "../../../lib/db";
import { hashPassword, createSessionCookie } from "../../../lib/auth";

// Admin accounts are NOT publicly self-serve. Creating one requires knowing
// ADMIN_INVITE_CODE, a secret you set as an environment variable and share
// only with people you trust to be admins. Without a matching code, this
// always fails — there is no other path to role='admin' in the codebase.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    if (!process.env.ADMIN_INVITE_CODE) {
      return res.status(500).json({ error: "Admin signup is not configured. Set ADMIN_INVITE_CODE in your environment." });
    }

    const { fullName, email, password, inviteCode } = req.body || {};
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: "Your full name is required." });
    }
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: "Email and a password of at least 6 characters are required." });
    }
    if (!inviteCode || inviteCode !== process.env.ADMIN_INVITE_CODE) {
      return res.status(403).json({ error: "Invalid invite code." });
    }

    const existing = await getUserByEmail(email.toLowerCase());
    if (existing) return res.status(409).json({ error: "An account with that email already exists." });

    const user = await createUser({
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      fullName: fullName.trim(),
      ageConfirmed: true,
      role: "admin",
    });
    res.setHeader("Set-Cookie", createSessionCookie(user.id));
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("admin signup failed:", err);
    res.status(500).json({ error: "Something went wrong creating the admin account. Please try again." });
  }
}
