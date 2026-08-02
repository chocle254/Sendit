import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Users, LogOut, LayoutDashboard } from "lucide-react";
import Logo from "./Logo";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/accounts", label: "Accounts", icon: Users },
];

export default function AdminLayout({ children, admin }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.admin) router.replace("/admin/login");
        else setChecked(true);
      });
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  if (!checked) {
    return <div className="min-h-screen bg-base text-white flex items-center justify-center text-muted text-sm">Checking admin access…</div>;
  }

  return (
    <div className="min-h-screen bg-base text-white flex">
      <aside className="w-56 shrink-0 border-r border-line/60 bg-panel/50 backdrop-blur-xl px-4 py-6 hidden md:flex md:flex-col">
        <div className="mb-1 px-2"><Logo size={24} /></div>
        <div className="mb-7 px-2 flex items-center gap-1.5 text-xs text-mint">
          <ShieldCheck size={13} strokeWidth={2.5} /> Admin
        </div>
        <nav className="space-y-1">
          {NAV.map((item) => {
            const active = item.href === "/admin" ? router.pathname === "/admin" : router.pathname.startsWith(item.href);
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
                    layoutId="admin-nav-active-pill"
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

      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 py-3 bg-panel/70 backdrop-blur-xl border-b border-line/60">
        <div className="flex items-center gap-1.5">
          <Logo size={20} />
          <span className="text-xs text-mint">Admin</span>
        </div>
        <button onClick={logout} className="text-muted hover:text-danger p-1.5 -mr-1.5" aria-label="Log out">
          <LogOut size={18} strokeWidth={2} />
        </button>
      </div>

      <main className="flex-1 px-6 py-8 pt-20 pb-24 md:pt-8 md:pb-8 max-w-5xl w-full mx-auto md:mx-0">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile bottom nav — was missing entirely, so Accounts was
          unreachable on mobile; mirrors DashboardLayout's pattern. */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-panel/80 backdrop-blur-xl border-t border-line/60 px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch justify-around">
          {NAV.map((item) => {
            const active = item.href === "/admin" ? router.pathname === "/admin" : router.pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center gap-1 py-2.5 px-2 flex-1 text-[11px]"
              >
                {active && (
                  <motion.span
                    layoutId="admin-nav-active-pill-mobile"
                    className="absolute top-1 h-8 w-8 rounded-full bg-panel2 shadow-neo-sm"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon size={18} strokeWidth={2} className={`relative z-10 ${active ? "text-mint" : "text-muted"}`} />
                <span className={`relative z-10 ${active ? "text-white" : "text-muted"}`}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
