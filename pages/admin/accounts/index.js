import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, MessageCircle, ShieldOff, ShieldCheck, Unlock } from "lucide-react";
import AdminLayout from "../../../components/AdminLayout";

export default function AdminAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  function load() {
    fetch("/api/admin/accounts/list")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function act(id, action) {
    setBusyId(id);
    setError("");
    try {
      let body = {};
      if (action === "suspend") {
        const reason = window.prompt("Reason for suspending this account (shown to the developer):") || "";
        body = { reason };
      }
      const res = await fetch(`/api/admin/accounts/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Action failed.");
        return;
      }
      load();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminLayout>
      <h1 className="font-display text-2xl font-semibold mb-1">Accounts</h1>
      <p className="text-muted text-sm mb-6">
        Every linked account across every developer, ranked by failure rate — highest first.
      </p>

      {error && <div className="text-danger text-sm mb-4">{error}</div>}

      {loading ? (
        <div className="text-muted text-sm">Loading…</div>
      ) : accounts.length === 0 ? (
        <div className="text-muted text-sm">No accounts yet.</div>
      ) : (
        <div className="space-y-3">
          {accounts.map((a) => (
            <div key={a.id} className="glass rounded-xl shadow-neo-sm p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{a.business_name}</span>
                    <StatusPill account={a} />
                    {a.unread_from_owner > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full text-mint bg-mintdim">
                        {a.unread_from_owner} unread
                      </span>
                    )}
                  </div>
                  <div className="text-muted text-xs mt-1">
                    {a.owner_full_name || "—"} · {a.owner_email}
                  </div>
                  <div className="text-xs mt-2 flex flex-wrap gap-x-4 gap-y-1 text-muted">
                    <span>Consecutive failures: <span className="text-white">{a.consecutive_failures}</span></span>
                    <span>Failure rate: <span className={Number(a.failure_rate_pct) > 30 ? "text-danger" : "text-white"}>{a.failure_rate_pct}%</span> ({a.failed_tx}/{a.total_tx})</span>
                    <span>Plan: <span className="text-white">{a.plan_expires_at && new Date(a.plan_expires_at) > new Date() ? a.plan : "none"}</span></span>
                    <span>Tokens: <span className="text-white">{a.token_balance}</span></span>
                    {a.on_parole && <span className="text-amber flex items-center gap-1"><AlertTriangle size={12} /> On parole</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/admin/accounts/${a.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-panel2 border border-line/60 hover:border-mint/60 transition-colors"
                  >
                    <MessageCircle size={13} /> View & message
                  </Link>
                  {a.on_parole && (
                    <ActionButton icon={Unlock} label="Lift parole" busy={busyId === a.id} onClick={() => act(a.id, "lift-parole")} />
                  )}
                  {a.status === "suspended" ? (
                    <ActionButton icon={ShieldCheck} label="Unsuspend" tone="mint" busy={busyId === a.id} onClick={() => act(a.id, "unsuspend")} />
                  ) : (
                    <ActionButton icon={ShieldOff} label="Suspend" tone="danger" busy={busyId === a.id} onClick={() => act(a.id, "suspend")} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

function StatusPill({ account }) {
  if (account.status === "suspended") {
    return <span className="text-xs px-2 py-0.5 rounded-full text-danger bg-dangerdim">Suspended</span>;
  }
  if (account.status === "payment_failed") {
    return <span className="text-xs px-2 py-0.5 rounded-full text-amber bg-amberdim">Payment failed</span>;
  }
  return <span className="text-xs px-2 py-0.5 rounded-full text-muted bg-line">{account.status}</span>;
}

function ActionButton({ icon: Icon, label, onClick, busy, tone }) {
  const toneClass = tone === "danger" ? "hover:border-danger/60 hover:text-danger" : tone === "mint" ? "hover:border-mint/60 hover:text-mint" : "";
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-panel2 border border-line/60 transition-colors disabled:opacity-50 ${toneClass}`}
    >
      <Icon size={13} /> {label}
    </button>
  );
}
