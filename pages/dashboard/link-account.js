import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Copy, Eye, EyeOff, Trash2, Zap, Calendar, Coins } from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import Skeleton from "../../components/Skeleton";
import { Field } from "../signup";

const PLAN_PRICE = { monthly: 10, yearly: 10 }; // kept in sync with lib/db.js PLAN_PRICES_KES (lowered for testing)

function formatExpiry(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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
  const [reviewing, setReviewing] = useState(false); // true once fields are filled and user hits "Review details"
  const [detailsConfirmed, setDetailsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // setActivating(true) is async — a fast double-click can fire this
  // handler twice before React re-renders the disabled button, which for
  // an STK push means a real second charge. A ref updates synchronously,
  // so it closes that gap in a way state alone can't.
  const activatingRef = useRef(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [error, setError] = useState("");
  const [reveal, setReveal] = useState({});
  const [activatingId, setActivatingId] = useState(null); // which account's panel is open
  const [activateMode, setActivateMode] = useState("monthly"); // 'monthly' | 'yearly' | 'tokens'
  const [activatePhone, setActivatePhone] = useState("");
  const [tokenAmount, setTokenAmount] = useState("10");
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState("");
  const [activateMessage, setActivateMessage] = useState("");
  // The STK request itself resolves in a second or two, but the actual
  // charge is only confirmed later via pollForActivation (up to ~40s).
  // activatingRef alone only blocks double-clicks during that first second —
  // it's cleared right after the push is sent. Without a separate flag
  // covering the polling window too, the button re-enables while a prompt
  // is still awaiting a PIN on the phone, and a second tap fires a second
  // real STK push/charge. This flag keeps the button disabled for the
  // whole window, not just the initial request.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [pollSecondsLeft, setPollSecondsLeft] = useState(0);

  async function loadAccounts(showSkeleton = true) {
    if (showSkeleton) setLoadingAccounts(true);
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
    // Background refresh so token/plan changes made from another tab, or
    // confirmed slightly late by Safaricom's callback, still show up here
    // without a manual page refresh. The in-panel pollForActivation already
    // covers the active purchase flow closely; this is the general safety
    // net for everything else (e.g. free_tx_used ticking up from live API
    // calls elsewhere).
    const interval = setInterval(() => loadAccounts(false), 8000);
    return () => clearInterval(interval);
  }, []);

  function set(key) {
    return (value) => setForm((f) => ({ ...f, [key]: value }));
  }

  function backToEdit() {
    setReviewing(false);
    setDetailsConfirmed(false);
  }

  function onReview(e) {
    e.preventDefault();
    setError("");
    setReviewing(true);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!detailsConfirmed) return; // button is disabled for this too, but guard the direct call as well
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/account/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, detailsConfirmed: true }),
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
      setReviewing(false);
      setDetailsConfirmed(false);
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
    setTokenAmount("10");
    setActivateError("");
    setActivateMessage("");
    setAwaitingConfirmation(false);
    setPollSecondsLeft(0);
  }

  async function submitActivate(e, accountId) {
    e.preventDefault();
    // Guard covers both the initial request AND the confirmation-polling
    // window that follows it — see awaitingConfirmation above.
    if (activatingRef.current || awaitingConfirmation) return;
    activatingRef.current = true;
    setActivateError("");
    setActivating(true);
    setAwaitingConfirmation(true);
    const mode = activateMode; // snapshot — activateMode can change while the STK prompt is out
    try {
      const endpoint = mode === "tokens" ? "/api/account/buy-tokens" : "/api/account/subscribe";
      const body =
        mode === "tokens"
          ? { accountId, phone: activatePhone, tokens: Number(tokenAmount) }
          : { accountId, phone: activatePhone, plan: mode };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        // Non-JSON response (infra-level error, e.g. a function timeout page) —
        // fall through to the generic message below instead of misreporting
        // this as "couldn't reach the server".
      }
      if (!res.ok) {
        setActivateError(data.error || `Request failed (${res.status}). Please try again.`);
        setAwaitingConfirmation(false); // request itself failed — nothing to poll for, safe to retry immediately
        return;
      }
      setActivateMessage("STK prompt sent — enter your PIN on your phone.");
      pollForActivation(accountId, mode, data.CheckoutRequestID);
      // NOTE: awaitingConfirmation stays true here — pollForActivation clears
      // it on every one of its own exit paths once the charge is resolved.
    } catch {
      setActivateError("Couldn't reach the server. Check your connection and try again.");
      setAwaitingConfirmation(false); // never reached Safaricom — safe to retry immediately
    } finally {
      setActivating(false);
      activatingRef.current = false;
    }
  }

  // Polls the account status for up to ~40s after a subscribe/token STK
  // push, since the callback that actually applies the plan/tokens lands
  // asynchronously once the customer enters their PIN. Purely watching the
  // DB (via /api/account/status) silently does nothing if Safaricom's
  // callback is delayed, dropped, or blocked — so from the 3rd attempt
  // onward this also asks Safaricom directly via the transaction-status
  // fallback endpoints, and always ends with an explicit message instead of
  // just quietly stopping.
  function pollForActivation(accountId, mode, checkoutRequestId) {
    let attempts = 0;
    const statusEndpoint = mode === "tokens" ? "/api/account/token-purchase-transaction-status" : "/api/account/subscription-transaction-status";
    const MAX_ATTEMPTS = 13;
    setPollSecondsLeft(MAX_ATTEMPTS * 3);

    const interval = setInterval(async () => {
      attempts += 1;
      setPollSecondsLeft(Math.max(0, (MAX_ATTEMPTS - attempts) * 3));
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

        // From the 3rd attempt (~9s in), also ask Safaricom directly — the
        // account's own numbers might not have moved yet only because the
        // webhook callback hasn't landed, not because nothing happened.
        if (attempts >= 3 && checkoutRequestId) {
          const qRes = await fetch(`${statusEndpoint}?checkoutRequestId=${checkoutRequestId}`);
          const qData = await qRes.json();
          if (qData.status === "success") {
            clearInterval(interval);
            setAwaitingConfirmation(false);
            const statusRes = await fetch(`/api/account/status?id=${accountId}`);
            const statusData = await statusRes.json();
            setActivateMessage(
              mode === "tokens"
                ? `Tokens added. New balance: ${statusData.tokenBalance}.`
                : `Subscription activated — active until ${formatExpiry(statusData.planExpiresAt)}.`
            );
            setAccounts((prev) =>
              prev.map((a) =>
                a.id === accountId
                  ? { ...a, plan: statusData.plan, plan_expires_at: statusData.planExpiresAt, free_tx_used: statusData.freeTxUsed, token_balance: statusData.tokenBalance }
                  : a
              )
            );
            return;
          }
          if (qData.status === "cancelled") {
            clearInterval(interval);
            setAwaitingConfirmation(false);
            setActivateMessage("");
            setActivateError(`Payment cancelled${qData.resultDesc ? ` — ${qData.resultDesc}` : ""}.`);
            return;
          }
          if (qData.status === "failed") {
            clearInterval(interval);
            setAwaitingConfirmation(false);
            setActivateMessage("");
            setActivateError(`Payment failed${qData.resultDesc ? ` — ${qData.resultDesc}` : ""}.`);
            return;
          }
        }
      } catch {
        // Ignore transient polling errors — the interval just retries.
      }
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        setAwaitingConfirmation(false);
        setActivateMessage("");
        setActivateError("Still waiting for confirmation from M-Pesa. Check the Transactions page in a moment, or try again.");
      }
    }, 3000);
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-semibold">Linked accounts</h1>
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            setShowForm((s) => !s);
            setReviewing(false);
            setDetailsConfirmed(false);
            setForm(EMPTY_FORM);
            setError("");
          }}
          className="flex items-center gap-1.5 bg-mint text-base px-4 py-2 rounded-md text-sm font-medium shadow-glow-mint"
        >
          <Plus size={15} strokeWidth={2.5} />
          Link new account
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="glass rounded-lg p-5 mb-6 space-y-4 shadow-neo-sm">
              {!reviewing ? (
                <>
                  <p className="text-muted text-sm">
                    Enter your business name and where payments should settle. You'll get an API key
                    immediately. Your first linked account gets 5 free STK pushes, no charge to link —
                    accounts after that need a subscription or purchased tokens right away.
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
                    type="button"
                    onClick={onReview}
                    disabled={
                      !form.businessName ||
                      (form.accountType === "till" && !form.tillNumber) ||
                      (form.accountType === "paybill" && (!form.paybillNumber || !form.paybillAccountNumber))
                    }
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-mint text-base px-4 py-2 rounded-md text-sm font-medium shadow-glow-mint disabled:opacity-50 disabled:shadow-none"
                  >
                    Review details
                  </motion.button>
                </>
              ) : (
                <form onSubmit={onSubmit} className="space-y-4">
                  <p className="text-muted text-sm">
                    Double-check every field below. <strong className="text-white">Sendit cannot reverse
                    or refund a payment sent to the wrong till, paybill, or account number</strong> —
                    once it's linked, real customer money can flow to exactly what's shown here.
                  </p>

                  <div className="bg-base/60 border border-line rounded-md p-4 shadow-neo-inset space-y-3">
                    <Info label="Business name" value={form.businessName} />
                    <Info label="Account type" value={form.accountType === "paybill" ? "Paybill" : "Till"} />
                    {form.accountType === "till" ? (
                      <Info label="Till number" value={form.tillNumber} mono />
                    ) : (
                      <>
                        <Info label="Paybill number" value={form.paybillNumber} mono />
                        <Info label="Account number" value={form.paybillAccountNumber} mono />
                      </>
                    )}
                  </div>

                  <label className="flex items-start gap-2.5 text-sm text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={detailsConfirmed}
                      onChange={(e) => setDetailsConfirmed(e.target.checked)}
                      className="mt-0.5 shrink-0"
                    />
                    <span>
                      I confirm these details are correct. Sendit cannot reverse or refund payments sent
                      to the wrong account.
                    </span>
                  </label>

                  {error && <div className="text-danger text-sm">{error}</div>}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={backToEdit}
                      className="px-4 py-2 rounded-md text-sm font-medium border border-line text-muted hover:text-white"
                    >
                      Back and edit
                    </button>
                    <motion.button
                      whileHover={detailsConfirmed ? { y: -1 } : {}}
                      whileTap={detailsConfirmed ? { scale: 0.98 } : {}}
                      disabled={!detailsConfirmed || submitting}
                      className="bg-mint text-base px-4 py-2 rounded-md text-sm font-medium shadow-glow-mint disabled:opacity-50 disabled:shadow-none"
                    >
                      {submitting ? "Linking account…" : "Confirm and link"}
                    </motion.button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
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
                        <ModeButton icon={Calendar} label="Monthly · KES 10" active={activateMode === "monthly"} onClick={() => setActivateMode("monthly")} />
                        <ModeButton icon={Calendar} label="Yearly · KES 10" active={activateMode === "yearly"} onClick={() => setActivateMode("yearly")} />
                        <ModeButton icon={Coins} label="Buy tokens" active={activateMode === "tokens"} onClick={() => setActivateMode("tokens")} />
                      </div>

                      {activateMode === "tokens" ? (
                        <div>
                          <span className="text-xs text-muted uppercase tracking-wide">Tokens (min 10, 1 token = KES 1 = 1 transaction)</span>
                          <input
                            type="number"
                            min={10}
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
                      {awaitingConfirmation && !activateError && (
                        <div className="text-muted text-xs">
                          Waiting for you to enter your PIN — this button unlocks once the payment is
                          confirmed{pollSecondsLeft > 0 ? ` (up to ${pollSecondsLeft}s)` : ""}. Only one
                          prompt is sent per attempt, so there's no need to tap again.
                        </div>
                      )}

                      <button
                        disabled={activating || awaitingConfirmation}
                        className="bg-mint text-base px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        {activating ? "Sending prompt…" : awaitingConfirmation ? "Awaiting confirmation…" : "Send STK prompt"}
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
        {label} · until {formatExpiry(account.plan_expires_at)}
      </span>
    );
  }
  const used = account.free_tx_used ?? 0;
  const remaining = Math.max(0, 5 - used);
  if (remaining === 0) {
    if ((account.token_balance ?? 0) >= 1) {
      return <span className="text-xs px-2 py-1 rounded-full text-mint bg-mintdim">{account.token_balance} token{account.token_balance === 1 ? "" : "s"} left</span>;
    }
    return <span className="text-xs px-2 py-1 rounded-full text-amber bg-amberdim">Free tier used — subscribe or buy tokens</span>;
  }
  return <span className="text-xs px-2 py-1 rounded-full text-mint bg-mintdim">{remaining} free left</span>;
}
