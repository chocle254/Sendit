import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Field } from "./signup";

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
    <div className="min-h-screen bg-base text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="font-mono text-mint font-semibold mb-8">stk://gateway</div>
        <h1 className="text-2xl font-semibold mb-1">Log in</h1>
        <p className="text-muted text-sm mb-6">Welcome back.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email" type="email" value={email} onChange={setEmail} required />
          <Field label="Password" type="password" value={password} onChange={setPassword} required />
          {error && <div className="text-danger text-sm">{error}</div>}
          <button
            disabled={loading}
            className="w-full bg-mint text-base font-medium py-2.5 rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="text-muted text-sm mt-6">
          Need an account?{" "}
          <Link href="/signup" className="text-mint">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
