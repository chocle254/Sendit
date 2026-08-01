import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "../components/Logo";

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        // Response wasn't JSON (e.g. an infra-level 500 with an HTML body).
      }
      if (!res.ok) {
        setError(data.error || `Request failed (${res.status}). Please try again.`);
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-base text-white flex items-center justify-center px-6 relative overflow-hidden">
      <div className="pointer-events-none absolute top-1/4 -right-24 h-80 w-80 rounded-full bg-mint/10 blur-3xl animate-float" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm glass rounded-xl shadow-glass p-7"
      >
        <div className="mb-8"><Logo size={26} /></div>
        <h1 className="font-display text-2xl font-semibold mb-1">Create your account</h1>
        <p className="text-muted text-sm mb-6">Link a till and start accepting M-Pesa in minutes.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email" type="email" value={email} onChange={setEmail} required />
          <Field label="Password" type="password" value={password} onChange={setPassword} required minLength={6} />
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-danger text-sm overflow-hidden"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
            className="w-full bg-mint text-base font-medium py-2.5 rounded-md shadow-glow-mint disabled:opacity-50 disabled:shadow-none"
          >
            {loading ? "Creating account…" : "Create account"}
          </motion.button>
        </form>
        <p className="text-muted text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-mint hover:underline">Log in</Link>
        </p>
      </motion.div>
    </div>
  );
}

export function Field({ label, type = "text", value, onChange, required, minLength }) {
  return (
    <label className="block">
      <span className="text-xs text-muted uppercase tracking-wide">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        minLength={minLength}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-base/60 border border-line rounded-md px-3 py-2 text-white shadow-neo-inset focus:outline-none focus:ring-2 focus:ring-mint/60 focus:border-mint/60 transition-shadow"
      />
    </label>
  );
}
