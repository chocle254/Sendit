import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import { Field } from "../signup";

const EMPTY_FORM = {
  businessName: "",
  accountType: "till",
  tillNumber: "",
  paybillNumber: "",
  paybillAccountNumber: "",
};

export default function LinkAccount() {
  const [accounts, setAccounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState({});

  async function loadAccounts() {
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/account/list");
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch {
      // Leave the previous list in place; the page still functions.
    } finally {
      setLoadingAccounts(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  function set(key) {
    return (value) => setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/account/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        // Non-JSON response (infra-level error) — fall through to generic message below.
      }
      if (!res.ok) {
        setError(data.error || `Request failed (${res.status}). Please try again.`);
        return;
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      await loadAccounts();
    } catch (err) {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id) {
    try {
      await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } finally {
      loadAccounts();
    }
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Linked accounts</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="bg-mint text-base px-4 py-2 rounded-md text-sm font-medium hover:opacity-90"
        >
          + Link new account
        </button>
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="bg-panel border border-line rounded-lg p-5 mb-6 space-y-4">
          <p className="text-muted text-sm">
            Enter your business name and where payments should settle. You'll get an API key
            immediately, good for 25 free STK pushes — no charge to link.
          </p>
          <p className="text-muted text-xs bg-base border border-line rounded-md p-3">
            <strong>Before your first live payment:</strong> log into the{" "}
            <a
              href="https://org.ke.m-pesa.com/"
              target="_blank"
              rel="noreferrer"
              className="text-mint underline"
            >
              M-Pesa Business Portal
            </a>{" "}
            for your till/paybill and add Sendit as an authorized API operator. Safaricom
            won't route payments to your account otherwise.
          </p>

          <Field label="Business name" value={form.businessName} onChange={set("businessName")} required />

          <div>
            <span className="text-xs text-muted uppercase tracking-wide">Account type</span>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => set("accountType")("till")}
                className={`px-3 py-2 rounded-md text-sm border ${
                  form.accountType === "till" ? "bg-mint text-base border-mint" : "border-line text-muted"
                }`}
              >
                Till
              </button>
              <button
                type="button"
                onClick={() => set("accountType")("paybill")}
                className={`px-3 py-2 rounded-md text-sm border ${
                  form.accountType === "paybill" ? "bg-mint text-base border-mint" : "border-line text-muted"
                }`}
              >
                Paybill
              </button>
            </div>
          </div>

          {form.accountType === "till" ? (
            <Field label="Till number" value={form.tillNumber} onChange={set("tillNumber")} required />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Paybill number" value={form.paybillNumber} onChange={set("paybillNumber")} required />
              <Field
                label="Account number"
                value={form.paybillAccountNumber}
                onChange={set("paybillAccountNumber")}
                required
              />
            </div>
          )}

          {error && <div className="text-danger text-sm">{error}</div>}
          <button
            disabled={submitting}
            className="bg-mint text-base px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Linking account…" : "Link account"}
          </button>
        </form>
      )}

      <div className="space-y-4">
        {loadingAccounts && (
          <p className="text-muted text-sm">Loading accounts…</p>
        )}
        {!loadingAccounts && accounts.length === 0 && !showForm && (
          <p className="text-muted text-sm">No accounts linked yet.</p>
        )}
        {accounts.map((a) => (
          <div key={a.id} className="bg-panel border border-line rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{a.business_name}</div>
              <UsagePill account={a} />
            </div>
            <div className="grid md:grid-cols-2 gap-4 mt-4 text-sm">
              <Info label="Type" value={a.account_type === "paybill" ? "Paybill" : "Till number"} />
              {a.account_type === "paybill" ? (
                <>
                  <Info label="Paybill number" value={a.paybill_number} mono />
                  <Info label="Account number" value={a.paybill_account_number} mono />
                </>
              ) : (
                <Info label="Till number" value={a.till_number} mono />
              )}
              <div>
                <div className="text-muted text-xs uppercase tracking-wide">API key</div>
                <div className="flex items-center gap-2 mt-1">
                  <code className="font-mono text-xs bg-base border border-line rounded px-2 py-1">
                    {reveal[a.id] ? a.api_key : maskKey(a.api_key)}
                  </code>
                  <button
                    onClick={() => setReveal((r) => ({ ...r, [a.id]: !r[a.id] }))}
                    className="text-xs text-muted hover:text-white"
                  >
                    {reveal[a.id] ? "Hide" : "Show"}
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(a.api_key)}
                    className="text-xs text-mint"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <Info label="API base URL" value="/api/v1/stkpush" mono />
            </div>
            <button onClick={() => onDelete(a.id)} className="text-danger text-xs mt-4 hover:underline">
              Delete
            </button>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}

function maskKey(key) {
  if (!key) return "";
  return key.slice(0, 11) + "•".repeat(18);
}

function Info({ label, value, mono }) {
  return (
    <div>
      <div className="text-muted text-xs uppercase tracking-wide">{label}</div>
      <div className={`mt-1 ${mono ? "font-mono text-xs" : "text-sm"}`}>{value}</div>
    </div>
  );
}

function UsagePill({ account }) {
  if (account.status === "payment_failed") {
    return <span className="text-xs px-2 py-1 rounded-full text-danger bg-red-950">Payment failed</span>;
  }
  if (account.status === "suspended") {
    return <span className="text-xs px-2 py-1 rounded-full text-danger bg-red-950">Suspended</span>;
  }
  const used = account.free_tx_used ?? 0;
  const remaining = Math.max(0, 25 - used);
  if (remaining === 0) {
    return <span className="text-xs px-2 py-1 rounded-full text-yellow-300 bg-yellow-950">Free tier used — pay KES 350</span>;
  }
  return <span className="text-xs px-2 py-1 rounded-full text-mint bg-mintdim">{remaining} free left</span>;
}
