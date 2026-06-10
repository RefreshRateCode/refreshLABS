import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";

const nav = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/customers", label: "Customers" },
  { to: "/invoices", label: "Invoices" },
  { to: "/bills", label: "Bills" },
  { to: "/projects", label: "Projects" },
  { to: "/settings", label: "Settings" },
];

export default function Layout() {
  const { session, signOut } = useAuth();
  const { theme, toggle } = useTheme();

  return (
    <div className="flex h-screen bg-bg text-content print:block print:h-auto">
      <aside className="flex w-56 flex-col border-r border-line bg-surface print:hidden">
        <div className="flex items-center gap-2 px-5 py-5">
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
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-brand/15 text-brand"
                    : "text-muted hover:bg-surface2 hover:text-content"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t border-line p-3">
          <button
            onClick={toggle}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted hover:bg-surface2 hover:text-content"
          >
            <span>{theme === "dark" ? "☀️" : "🌙"}</span>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <div className="truncate px-3 pt-1 text-xs text-faint">
            {session?.user.email}
          </div>
          <button
            onClick={signOut}
            className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-muted hover:bg-surface2 hover:text-content"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto print:overflow-visible">
        <div className="mx-auto max-w-5xl px-8 py-8 print:max-w-none print:p-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
