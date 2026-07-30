import Link from "next/link";
import { useRouter } from "next/router";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/link-account", label: "Linked accounts" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/webhooks", label: "Webhooks" },
];

export default function DashboardLayout({ children }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-base text-white flex">
      <aside className="w-56 border-r border-line px-4 py-6 hidden md:block">
        <div className="font-mono text-mint font-semibold mb-8 px-2">stk://gateway</div>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-md text-sm ${
                router.pathname === item.href
                  ? "bg-panel text-white"
                  : "text-muted hover:text-white hover:bg-panel"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={logout}
          className="mt-8 px-3 py-2 text-sm text-muted hover:text-danger"
        >
          Log out
        </button>
      </aside>
      <main className="flex-1 px-6 py-8 max-w-4xl">{children}</main>
    </div>
  );
}
