import { Suspense, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  CreditCard,
  Calculator,
  FolderKanban,
  BarChart3,
  Settings as SettingsIcon,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";

const nav: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/bills", label: "Bills", icon: Receipt },
  { to: "/expenses", label: "Expenses", icon: CreditCard },
  { to: "/estimator", label: "Estimator", icon: Calculator },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

// Tooltip shown to the right of a rail item on hover (desktop only).
function Tip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-line bg-surface2 px-2 py-1 text-xs font-medium text-content opacity-0 shadow-lg transition-opacity group-hover:opacity-100 lg:block">
      {label}
    </span>
  );
}

export default function Layout() {
  const { session, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen bg-bg text-content print:block print:h-auto">
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden print:hidden">
        <button
          onClick={() => setOpen(true)}
          className="text-muted hover:text-content"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <img src="/logo.png" alt="noalanPRO" className="only-dark h-6 w-auto" />
        <img
          src="/noalanpro-black.png"
          alt="noalanPRO"
          className="only-light h-5 w-auto"
        />
        <span className="text-sm font-semibold text-content">Ops</span>
      </header>

      {/* Backdrop (mobile, when drawer open) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-line bg-surface transition-transform duration-200 lg:static lg:w-16 lg:translate-x-0 print:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand: full logo on the mobile drawer, compact mark on the rail */}
        <div className="flex items-center justify-between px-5 py-5 lg:hidden">
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="noalanPRO"
              className="only-dark h-7 w-auto"
            />
            <img
              src="/noalanpro-black.png"
              alt="noalanPRO"
              className="only-light h-6 w-auto"
            />
            <span className="text-sm font-semibold text-content">Ops</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-muted hover:text-content"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <div className="hidden justify-center py-5 lg:flex">
          <img
            src="/favicon.png"
            alt="noalanPRO Ops"
            className="h-8 w-8 rounded-md"
          />
        </div>

        <nav className="flex-1 space-y-1 px-3 lg:px-2">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              title={label}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition lg:justify-center lg:gap-0 lg:px-0 ${
                  isActive
                    ? "bg-brand/15 text-brand"
                    : "text-muted hover:bg-surface2 hover:text-content"
                }`
              }
            >
              <Icon size={18} strokeWidth={2} />
              <span className="lg:hidden">{label}</span>
              <Tip label={label} />
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t border-line p-3 lg:px-2">
          <button
            onClick={toggle}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className="group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-muted hover:bg-surface2 hover:text-content lg:justify-center lg:gap-0 lg:px-0"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            <span className="lg:hidden">
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
            <Tip label={theme === "dark" ? "Light mode" : "Dark mode"} />
          </button>
          <div className="truncate px-3 pt-1 text-xs text-faint lg:hidden">
            {session?.user.email}
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-muted hover:bg-surface2 hover:text-content lg:justify-center lg:gap-0 lg:px-0"
          >
            <LogOut size={18} />
            <span className="lg:hidden">Sign out</span>
            <Tip label="Sign out" />
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto pt-14 lg:pt-0 print:overflow-visible print:pt-0">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8 print:max-w-none print:p-0">
          <Suspense fallback={<p className="text-faint">Loading…</p>}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
