import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send } from "lucide-react";

export default function ChatWidget() {
  const [me, setMe] = useState(undefined); // undefined = not checked yet, null = logged out
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef(null);

  // Who's logged in, and — if a developer — which accounts they can chat about.
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setMe(d.user || null));
  }, []);

  useEffect(() => {
    if (!me) return;
    fetch("/api/account/list")
      .then((r) => r.json())
      .then((d) => {
        const list = d.accounts || [];
        setAccounts(list);
        if (list.length) setAccountId((prev) => prev || list[0].id);
      });
  }, [me]);

  // Poll unread count for the badge, whether or not the panel is open.
  useEffect(() => {
    if (!me) return;
    function poll() {
      fetch("/api/messages/unread-count").then((r) => r.json()).then((d) => setUnread(d.count || 0));
    }
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [me]);

  function loadMessages() {
    if (!accountId) return;
    fetch(`/api/messages/list?accountId=${accountId}`)
      .then((r) => r.json())
      .then((d) => {
        setMessages(d.messages || []);
        setUnread(0);
      });
  }

  useEffect(() => {
    if (!open || !accountId) return;
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [open, accountId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim() || !accountId) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, body: draft.trim() }),
      });
      if (res.ok) {
        setDraft("");
        loadMessages();
      }
    } finally {
      setSending(false);
    }
  }

  // Admins have their own chat inside each account's god view — this
  // floating widget is the developer-facing support channel.
  if (me === undefined) return null;
  if (me?.role === "admin") return null;

  return (
    <>
      <motion.button
        onClick={() => setOpen((v) => !v)}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.96 }}
        aria-label="Chat with support"
        className="fixed z-50 bottom-24 right-4 md:bottom-5 md:right-5 flex items-center gap-2 px-[18px] py-3 rounded-full font-semibold text-sm text-base bg-mint shadow-glow-mint"
      >
        {open ? <X size={18} /> : <MessageCircle size={18} />}
        {!open && "Chat with support"}
        {!open && unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-danger text-white text-[11px] flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed z-50 bottom-40 right-4 md:bottom-24 md:right-5 w-[90vw] max-w-sm glass rounded-xl shadow-glass flex flex-col h-[28rem]"
          >
            {!me ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <MessageCircle size={28} className="text-mint" />
                <p className="text-sm text-muted">Log in to chat with Sendit support.</p>
                <Link href="/login" className="text-mint text-sm hover:underline">Log in</Link>
              </div>
            ) : accounts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <MessageCircle size={28} className="text-mint" />
                <p className="text-sm text-muted">Link an account first, then you can chat with support about it.</p>
                <Link href="/dashboard/link-account" className="text-mint text-sm hover:underline">Link an account</Link>
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-line/60">
                  <div className="text-sm font-medium">Sendit support</div>
                  {accounts.length > 1 ? (
                    <select
                      value={accountId || ""}
                      onChange={(e) => setAccountId(e.target.value)}
                      className="mt-1 w-full bg-base/60 border border-line rounded-md px-2 py-1 text-xs text-white"
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.business_name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-xs text-muted mt-0.5">{accounts[0]?.business_name}</div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {messages.length === 0 && <div className="text-muted text-xs">No messages yet — say hi!</div>}
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[85%] text-xs px-3 py-2 rounded-lg ${
                        m.sender_role === "owner" ? "bg-mint text-base ml-auto" : "bg-panel2 border border-line/60"
                      }`}
                    >
                      {m.body}
                      <div className={`mt-1 text-[10px] ${m.sender_role === "owner" ? "text-base/60" : "text-muted"}`}>
                        {new Date(m.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={sendMessage} className="p-3 border-t border-line/60 flex gap-2">
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
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
