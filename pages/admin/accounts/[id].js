import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { AlertTriangle, ShieldOff, ShieldCheck, Unlock, Send } from "lucide-react";
import AdminLayout from "../../../components/AdminLayout";

export default function AdminAccountDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  function loadAccount() {
    if (!id) return;
    fetch(`/api/admin/accounts/${id}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }

  function loadMessages() {
    if (!id) return;
    fetch(`/api/messages/list?accountId=${id}`)
      .then((r) => r.json())
      .then((d) => setMessages(d.messages || []));
  }

  useEffect(loadAccount, [id]);
  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [id]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function act(action) {
    setBusy(true);
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
      loadAccount();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: id, body: draft.trim() }),
      });
      if (res.ok) {
        setDraft("");
        loadMessages();
      }
    } finally {
      setSending(false);
    }
  }

  if (loading || !data) {
    return (
      <AdminLayout>
        <div className="text-muted text-sm">Loading…</div>
      </AdminLayout>
    );
  }

  const { account, transactions, adminActions } = data;

  return (
    <AdminLayout>
      <button onClick={() => router.push("/admin")} className="text-muted text-xs hover:text-white mb-4">← All accounts</button>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-semibold">{account.business_name}</h1>
          <p className="text-muted text-sm mt-1">{account.owner_full_name || "—"} · {account.owner_email}</p>
        </div>
        <div className="flex items-center gap-2">
          {account.on_parole && (
            <button onClick={() => act("lift-parole")} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-panel2 border border-line/60 hover:border-mint/60 hover:text-mint disabled:opacity-50">
              <Unlock size={13} /> Lift parole
            </button>
          )}
          {account.status === "suspended" ? (
            <button onClick={() => act("unsuspend")} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-panel2 border border-line/60 hover:border-mint/60 hover:text-mint disabled:opacity-50">
              <ShieldCheck size={13} /> Unsuspend
            </button>
          ) : (
            <button onClick={() => act("suspend")} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-panel2 border border-line/60 hover:border-danger/60 hover:text-danger disabled:opacity-50">
              <ShieldOff size={13} /> Suspend
            </button>
          )}
        </div>
      </div>

      {error && <div className="text-danger text-sm mb-4">{error}</div>}

      {/* Account snapshot */}
      <div className="glass rounded-xl shadow-neo-sm p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <Stat label="Status" value={account.status} />
        <Stat label="Plan" value={account.plan_expires_at && new Date(account.plan_expires_at) > new Date() ? `${account.plan} (until ${new Date(account.plan_expires_at).toLocaleDateString()})` : "none"} />
        <Stat label="Token balance" value={account.token_balance} />
        <Stat label="Free used" value={account.free_tx_used} />
        <Stat label="Consecutive failures" value={account.consecutive_failures} />
        <Stat label="On parole" value={account.on_parole ? "Yes" : "No"} warn={account.on_parole} />
        <Stat label="Payout" value={account.till_number ? `Till ${account.till_number}` : account.paybill_number ? `Paybill ${account.paybill_number}` : account.payout_phone || "—"} />
        <Stat label="Linked" value={new Date(account.created_at).toLocaleDateString()} />
      </div>

      {account.suspended_reason && (
        <div className="mb-6 text-sm text-danger bg-dangerdim rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" />
          Suspended: {account.suspended_reason}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chat */}
        <div className="glass rounded-xl shadow-neo-sm p-4 flex flex-col h-96">
          <div className="text-sm font-medium mb-3">Message {account.owner_full_name || "developer"}</div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {messages.length === 0 && <div className="text-muted text-xs">No messages yet.</div>}
            {messages.map((m) => (
              <div key={m.id} className={`max-w-[85%] text-xs px-3 py-2 rounded-lg ${m.sender_role === "admin" ? "bg-mint text-base ml-auto" : "bg-panel2 border border-line/60"}`}>
                {m.body}
                <div className={`mt-1 text-[10px] ${m.sender_role === "admin" ? "text-base/60" : "text-muted"}`}>
                  {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={sendMessage} className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message…"
              className="flex-1 bg-base/60 border border-line rounded-md px-3 py-2 text-sm text-white shadow-neo-inset focus:outline-none focus:ring-2 focus:ring-mint/60"
            />
            <button disabled={sending || !draft.trim()} className="px-3 py-2 rounded-md bg-mint text-base disabled:opacity-50">
              <Send size={15} />
            </button>
          </form>
        </div>

        {/* Transactions */}
        <div className="glass rounded-xl shadow-neo-sm p-4 h-96 overflow-y-auto">
          <div className="text-sm font-medium mb-3">Transaction history ({transactions.length})</div>
          <div className="space-y-2">
            {transactions.length === 0 && <div className="text-muted text-xs">No transactions yet.</div>}
            {transactions.map((t) => (
              <div key={t.id} className="text-xs border-b border-line/40 pb-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono">{t.type}</span>
                  <span className={
                    t.status === "success" ? "text-mint" : t.status === "cancelled" ? "text-muted" : t.status === "failed" ? "text-danger" : "text-amber"
                  }>{t.status}</span>
                </div>
                <div className="text-muted mt-0.5">{t.phone} · KES {t.amount} · {new Date(t.created_at).toLocaleString()}</div>
                {t.result_desc && <div className="text-muted mt-0.5">{t.result_desc}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Admin action log */}
      {adminActions.length > 0 && (
        <div className="glass rounded-xl shadow-neo-sm p-4 mt-6">
          <div className="text-sm font-medium mb-3">Admin action log</div>
          <div className="space-y-2">
            {adminActions.map((a) => (
              <div key={a.id} className="text-xs text-muted">
                <span className="text-white">{a.action}</span> by {a.admin_email || "unknown"} — {new Date(a.created_at).toLocaleString()}
                {a.admin_note && <span> — "{a.admin_note}"</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function Stat({ label, value, warn }) {
  return (
    <div>
      <div className="text-muted text-xs uppercase tracking-wide">{label}</div>
      <div className={`mt-1 ${warn ? "text-amber" : "text-white"}`}>{value}</div>
    </div>
  );
}
