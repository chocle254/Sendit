import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell } from "lucide-react";

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  function pollCount() {
    fetch("/api/notifications/list")
      .then((r) => r.json())
      .then((d) => {
        setUnreadCount(d.unreadCount || 0);
        setNotifications(d.notifications || []);
      });
  }

  useEffect(() => {
    pollCount();
    const interval = setInterval(pollCount, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      await fetch("/api/notifications/read", { method: "POST" });
      setUnreadCount(0);
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button onClick={toggle} className="relative p-1.5 text-muted hover:text-white transition-colors" aria-label="Notifications">
        <Bell size={18} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-danger text-white text-[10px] flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto glass rounded-lg shadow-glass p-2 z-50"
          >
            {notifications.length === 0 ? (
              <div className="text-muted text-xs p-3 text-center">No notifications yet.</div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="p-2.5 rounded-md hover:bg-panel2/60">
                  <div className="text-xs font-medium">{n.title}</div>
                  {n.body && <div className="text-xs text-muted mt-0.5">{n.body}</div>}
                  <div className="text-[10px] text-muted mt-1">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
