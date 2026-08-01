import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Copy, Eye, EyeOff, Trash2, Zap, Calendar, Coins } from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import Skeleton from "../../components/Skeleton";
import { Field } from "../signup";

const PLAN_PRICE = { monthly: 500, yearly: 5000 };

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
  const [activatingId, setActivatingId] = useState(null); // which account's panel is open
  const [activateMode, setActivateMode] = useState("monthly"); // 'monthly' | 'yearly' | 'tokens'
  const [activatePhone, setActivatePhone] = useState("");
  const [tokenAmount, setTokenAmount] = useState("100");
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState("");
  const [activateMessage, setActivateMessage] = useState("");

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

  function openActivate(accountId) {
    setActivatingId((current) => (current === accountId ? null : accountId));
    setActivateMode("monthly");
    setActivatePhone("");
    setTokenAmount("100");
    setActivateError("");
    setActivateMessage("");
  }

  async function submitActivate(e, accountId) {
    e.preventDefault();
    setActivateError("");
    setActivating(true);
    try {
      const endpoint = activateMode === "tokens" ? "/api/account/buy-tokens" : "/api/account/subscribe";
      const body =
        activateMode === "tokens"
          ? { accountId, phone: activatePhone, tokens: Number(tokenAmount) }
          : { accountId, phone: activatePhone, plan: activateMode };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setActivateError(data.error || "Something went wrong.");
        return;
      }
      setActivateMessage("STK prompt sent — enter your PIN on your phone.");
      pollForActivation(accountId);
    } catch {
      setActivateError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setActivating(false);
    }
  }

  // Polls the account status for up to ~40s after a subscribe/token STK
  // push, since the callback that actually applies the plan/tokens lands
  // asynchronously once the customer enters their PIN.
  function pollForActivation(accountId) {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/account/status?id=${accountId}`);
        const data = await res.json();
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === accountId
              ? { ...a, plan: data.plan, plan_expires_at: data.planExpiresAt, free_tx_used: data.freeTxUsed, token_balance: data.tokenBalance }
              : a
          )
        );
      } catch {
        // Ignore transient polling errors — the interval just retries.
      }
      if (attempts >= 13) clearInterval(interval); // ~40s at 3s intervals
    }, 3000);
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold">Linked accounts</h1>
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1.5 bg-mint text-base px-4 py-2 rounded-md text-sm font-medium shadow-glow-mint"
        >
          <Plus size={15} strokeWidth={2.5} />
          Link new account
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            onSubmit={onSubmit}
            className="overflow-hidden"
          >
            <div className="glass rounded-lg p-5 mb-6 space-y-4 shadow-neo-sm">
              <p className="text-muted text-sm">
                Enter your business name and where payments should settle. You'll get an API key
                immediately, good for 25 free STK pushes — no charge to link.
              </p>
              <p className="text-muted text-xs bg-base/60 border border-line rounded-md p-3 shadow-neo-inset">
                <strong className="text-white">Before your first live payment:</strong> log into the{" "}
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
                    className={`px-3 py-2 rounded-md text-sm border transition-all ${
                      form.accountType === "till"
                        ? "bg-mint text-base border-mint shadow-glow-mint"
                        : "border-line text-muted shadow-neo-sm"
                    }`}
                  >
                    Till
                  </button>
                  <button
                    type="button"
                    onClick={() => set("accountType")("paybill")}
                    className={`px-3 py-2 rounded-md text-sm border transition-all ${
                      form.accountType === "paybill"
                        ? "bg-mint text-base border-mint shadow-glow-mint"
                        : "border-line text-muted shadow-neo-sm"
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
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                disabled={submitting}
                className="bg-mint text-base px-4 py-2 rounded-md text-sm font-medium shadow-glow-mint disabled:opacity-50 disabled:shadow-none"
              >
                {submitting ? "Linking account…" : "Link account"}
              </motion.button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {loadingAccounts && (
          <div className="space-y-4">
            <AccountCardSkeleton />
            <AccountCardSkeleton />
          </div>
        )}
        {!loadingAccounts && accounts.length === 0 && !showForm && (
          <p className="text-muted text-sm">No accounts linked yet.</p>
        )}
        <AnimatePresence>
          {accounts.map((a, i) => (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}
              className="glass rounded-lg p-5 shadow-neo-sm"
            >
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
                <div className="min-w-0">
                  <div className="text-muted text-xs uppercase tracking-wide">API key</div>
                  <div className="flex items-center gap-2 mt-1 min-w-0">
                    <code className="font-mono text-xs bg-base/60 border border-line rounded px-2 py-1 shadow-neo-inset block max-w-[11rem] sm:max-w-[14rem] overflow-x-auto whitespace-nowrap">
                      {reveal[a.id] ? a.api_key : maskKey(a.api_key)}
                    </code>
                    <button
                      onClick={() => setReveal((r) => ({ ...r, [a.id]: !r[a.id] }))}
                      className="text-muted hover:text-white p-1 shrink-0"
                      aria-label={reveal[a.id] ? "Hide API key" : "Show API key"}
                    >
                      {reveal[a.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(a.api_key)}
                      className="text-mint hover:opacity-80 p-1 shrink-0"
                      aria-label="Copy API key"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
                <Info label="API base URL" value="/api/v1/stkpush" mono />
              </div>

              <div className="flex items-center gap-4 mt-4">
                <button
                  onClick={() => openActivate(a.id)}
                  className="flex items-center gap-1.5 text-mint text-xs font-medium hover:opacity-80"
                >
                  <Zap size={12} />
                  {activatingId === a.id ? "Close" : "Activate / buy tokens"}
                </button>
                <button
                  onClick={() => onDelete(a.id)}
                  className="flex items-center gap-1.5 text-danger text-xs hover:underline"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </div>

              <AnimatePresence>
                {activatingId === a.id && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    onSubmit={(e) => submitActivate(e, a.id)}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 bg-base/60 border border-line rounded-md p-4 shadow-neo-inset space-y-3">
                      <div className="flex gap-2">
                        <ModeButton icon={Calendar} label="Monthly · KES 500" active={activateMode === "monthly"} onClick={() => setActivateMode("monthly")} />
                        <ModeButton icon={Calendar} label="Yearly · KES 5,000" active={activateMode === "yearly"} onClick={() => setActivateMode("yearly")} />
                        <ModeButton icon={Coins} label="Buy tokens" active={activateMode === "tokens"} onClick={() => setActivateMode("tokens")} />
                      </div>

                      {activateMode === "tokens" ? (
                        <div>
                          <span className="text-xs text-muted uppercase tracking-wide">Tokens (min 25, 1 token = KES 1 = 1 transaction)</span>
                          <input
                            type="number"
                            min={25}
                            value={tokenAmount}
                            onChange={(e) => setTokenAmount(e.target.value)}
                            className="mt-1 w-full bg-panel border border-line rounded-md px-3 py-2 text-white shadow-neo-inset focus:outline-none focus:ring-2 focus:ring-mint/60"
                          />
                        </div>
                      ) : (
                        <p className="text-muted text-xs">
                          {activateMode === "monthly"
                            ? "Unlimited STK pushes for 30 days from today (or extended from your current plan's expiry if it's still active)."
                            : "Unlimited STK pushes for 365 days from today (or extended from your current plan's expiry if it's still active)."}
                        </p>
                      )}

                      <Field label="Phone number to pay from (2547XXXXXXXX)" value={activatePhone} onChange={setActivatePhone} required />

                      {activateError && <div className="text-danger text-sm">{activateError}</div>}
                      {activateMessage && <div className="text-mint text-sm">{activateMessage}</div>}

                      <button
                        disabled={activating}
                        className="bg-mint text-base px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        {activating ? "Sending prompt…" : "Send STK prompt"}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

function AccountCardSkeleton() {
  return (
    <div className="glass rounded-lg p-5 shadow-neo-sm">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}

function ModeButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs border transition-all ${
        active ? "bg-mint text-base border-mint shadow-glow-mint" : "border-line text-muted shadow-neo-sm"
      }`}
    >
      <Icon size={12} />
      {label}
    </button>
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
    return <span className="text-xs px-2 py-1 rounded-full text-danger bg-dangerdim">Payment failed</span>;
  }
  if (account.status === "suspended") {
    return <span className="text-xs px-2 py-1 rounded-full text-danger bg-dangerdim">Suspended</span>;
  }
  const planActive = account.plan_expires_at && new Date(account.plan_expires_at) > new Date();
  if (planActive) {
    const label = account.plan === "yearly" ? "Yearly plan" : "Monthly plan";
    return (
      <span className="text-xs px-2 py-1 rounded-full text-mint bg-mintdim">
        {label} · until {new Date(account.plan_expires_at).toLocaleDateString()}
      </span>
    );
  }
  const used = account.free_tx_used ?? 0;
  const remaining = Math.max(0, 25 - used);
  if (remaining === 0) {
    if ((account.token_balance ?? 0) >= 1) {
      return <span className="text-xs px-2 py-1 rounded-full text-mint bg-mintdim">{account.token_balance} token{account.token_balance === 1 ? "" : "s"} left</span>;
    }
    return <span className="text-xs px-2 py-1 rounded-full text-amber bg-amberdim">Free tier used — subscribe or buy tokens</span>;
  }
  return <span className="text-xs px-2 py-1 rounded-full text-mint bg-mintdim">{remaining} free left</span>;
}
