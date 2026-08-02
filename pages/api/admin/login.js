import { getUserByEmail } from "../../../lib/db";
import { verifyPassword, createSessionCookie } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { email, password } = req.body || {};
    const user = await getUserByEmail((email || "").toLowerCase());
    if (!user || !verifyPassword(password || "", user.password_hash)) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }
    if (user.role !== "admin") {
      return res.status(403).json({ error: "This account doesn't have admin access." });
    }
    res.setHeader("Set-Cookie", createSessionCookie(user.id));
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("admin login failed:", err);
    res.status(500).json({ error: "Something went wrong logging you in. Please try again." });
  }
}
