import { createUser, getUserByEmail } from "../../../lib/db";
import { hashPassword, createSessionCookie } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { fullName, email, password, ageConfirmed, tosAccepted } = req.body || {};

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: "Your full name is required." });
    }
    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: "Email and a password of at least 6 characters are required." });
    }
    if (!ageConfirmed) {
      return res.status(400).json({ error: "Please confirm you're 18 years or older to sign up." });
    }
    if (!tosAccepted) {
      return res.status(400).json({ error: "Please agree to the Terms of Service and Privacy Policy to continue." });
    }

    const existing = await getUserByEmail(email.toLowerCase());
    if (existing) return res.status(409).json({ error: "An account with that email already exists." });

    const user = await createUser({
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      fullName: fullName.trim(),
      ageConfirmed: true,
    });
    res.setHeader("Set-Cookie", createSessionCookie(user.id));
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("signup failed:", err);
    res.status(500).json({ error: "Something went wrong creating your account. Please try again." });
  }
}
