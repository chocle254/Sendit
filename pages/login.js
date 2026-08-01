import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Field } from "./signup";
import Logo from "../components/Logo";

export default function Login() {
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
      const res = await fetch("/api/auth/login", {
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
      <div className="pointer-events-none absolute top-1/3 -left-24 h-80 w-80 rounded-full bg-amber/10 blur-3xl animate-float" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm glass rounded-xl shadow-glass p-7"
      >
        <div className="mb-8"><Logo size={26} /></div>
        <h1 className="font-display text-2xl font-semibold mb-1">Log in</h1>
        <p className="text-muted text-sm mb-6">Welcome back.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email" type="email" value={email} onChange={setEmail} required />
          <Field label="Password" type="password" value={password} onChange={setPassword} required />
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
            {loading ? "Logging in…" : "Log in"}
          </motion.button>
        </form>
        <p className="text-muted text-sm mt-6">
          Need an account?{" "}
          <Link href="/signup" className="text-mint hover:underline">Sign up</Link>
        </p>
      </motion.div>
    </div>
  );
}
