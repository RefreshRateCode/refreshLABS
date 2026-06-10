import { Suspense, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  FolderKanban,
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
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

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
        className={`fixed inset-y-0 left-0 z-50 flex w-56 flex-col border-r border-line bg-surface transition-transform duration-200 lg:static lg:translate-x-0 print:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
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
            className="text-muted hover:text-content lg:hidden"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-brand/15 text-brand"
                    : "text-muted hover:bg-surface2 hover:text-content"
                }`
              }
            >
              <Icon size={17} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t border-line p-3">
          <button
            onClick={toggle}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-muted hover:bg-surface2 hover:text-content"
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className="truncate px-3 pt-1 text-xs text-faint">
            {session?.user.email}
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium text-muted hover:bg-surface2 hover:text-content"
          >
            <LogOut size={17} />
            Sign out
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
