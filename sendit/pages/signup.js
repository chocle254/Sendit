import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

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
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) return setError(data.error || "Something went wrong.");
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-base text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="font-mono text-mint font-semibold mb-8">stk://gateway</div>
        <h1 className="text-2xl font-semibold mb-1">Create your account</h1>
        <p className="text-muted text-sm mb-6">Link a till and start accepting M-Pesa in minutes.</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email" type="email" value={email} onChange={setEmail} required />
          <Field label="Password" type="password" value={password} onChange={setPassword} required minLength={6} />
          {error && <div className="text-danger text-sm">{error}</div>}
          <button
            disabled={loading}
            className="w-full bg-mint text-base font-medium py-2.5 rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className="text-muted text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-mint">Log in</Link>
        </p>
      </div>
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
        className="mt-1 w-full bg-panel border border-line rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-mint"
      />
    </label>
  );
}
