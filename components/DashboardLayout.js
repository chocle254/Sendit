import Link from "next/link";
import { useRouter } from "next/router";
import { motion } from "framer-motion";
import { LayoutDashboard, Link2, ArrowLeftRight, Webhook, LogOut } from "lucide-react";
import Logo from "./Logo";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/link-account", label: "Linked accounts", icon: Link2 },
  { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: Webhook },
];

export default function DashboardLayout({ children }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-base text-white flex">
      {/* Desktop sidebar */}
      <aside className="w-56 shrink-0 border-r border-line/60 bg-panel/50 backdrop-blur-xl px-4 py-6 hidden md:flex md:flex-col">
        <div className="mb-8 px-2"><Logo size={24} /></div>
        <nav className="space-y-1">
          {NAV.map((item) => {
            const active = router.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? "text-white" : "text-muted hover:text-white"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active-pill"
                    className="absolute inset-0 rounded-lg bg-panel2 shadow-neo-sm border border-line/60"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon size={16} className="relative z-10" strokeWidth={2} />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <button
          onClick={logout}
          className="mt-auto flex items-center gap-2.5 px-3 py-2 text-sm text-muted hover:text-danger transition-colors"
        >
          <LogOut size={16} strokeWidth={2} />
          Log out
        </button>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 py-3 bg-panel/70 backdrop-blur-xl border-b border-line/60">
        <Logo size={20} />
        <button onClick={logout} className="text-muted hover:text-danger p-1.5 -mr-1.5" aria-label="Log out">
          <LogOut size={18} strokeWidth={2} />
        </button>
      </div>

      <main className="flex-1 px-6 py-8 pt-20 pb-24 md:pt-8 md:pb-8 max-w-4xl w-full mx-auto md:mx-0">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-panel/80 backdrop-blur-xl border-t border-line/60 px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around">
          {NAV.map((item) => {
            const active = router.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center gap-1 py-2.5 px-2 flex-1 text-[11px]"
              >
                {active && (
                  <motion.span
                    layoutId="nav-active-pill-mobile"
                    className="absolute top-1 h-8 w-8 rounded-full bg-panel2 shadow-neo-sm"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon size={18} strokeWidth={2} className={`relative z-10 ${active ? "text-mint" : "text-muted"}`} />
                <span className={`relative z-10 ${active ? "text-white" : "text-muted"}`}>{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
