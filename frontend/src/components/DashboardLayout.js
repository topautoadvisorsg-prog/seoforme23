import { useEffect, useMemo, useState } from "react";
import { Outlet, NavLink, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  BarChart3,
  Bell,
  Settings,
  ChevronDown,
  LogOut,
  UserCircle,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { approvalsService } from "@/services/approvalsService";

function NavItem({ to, icon: Icon, label, badge, end = false, testId }) {
  return (
    <NavLink
      to={to}
      end={end}
      data-testid={testId}
      className={({ isActive }) =>
        `flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
          isActive
            ? "nav-active font-medium"
            : "text-[rgb(var(--color-text))] hover:bg-gray-100"
        }`
      }
    >
      <span className="flex items-center gap-3">
        <Icon size={18} strokeWidth={1.75} />
        {label}
      </span>
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-[rgb(var(--color-primary))] px-2 py-0.5 text-[10px] font-semibold text-white">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export default function DashboardLayout() {
  const { operator, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Live pending-approvals badge. Refreshed on mount and whenever the
  // Approvals page signals a change via the "approvals:changed" event.
  useEffect(() => {
    const refresh = () =>
      approvalsService
        .list({ status: "pending" })
        .then((d) => setPendingCount(d.counts?.pending || 0))
        .catch(() => {});
    refresh();
    window.addEventListener("approvals:changed", refresh);
    return () => window.removeEventListener("approvals:changed", refresh);
  }, []);

  const isAdmin = operator?.role === "admin";
  const isAdminOrManager = isAdmin || operator?.role === "manager";

  const navItems = useMemo(
    () => [
      {
        to: "/dashboard",
        end: true,
        icon: LayoutDashboard,
        label: "Overview",
        testId: "nav-overview",
      },
      { to: "/dashboard/clients", icon: Users, label: "Clients", testId: "nav-clients" },
      {
        to: "/dashboard/approvals",
        icon: CheckSquare,
        label: "Approvals",
        badge: pendingCount,
        testId: "nav-approvals",
      },
      ...(isAdminOrManager
        ? [
            {
              to: "/dashboard/analytics",
              icon: BarChart3,
              label: "Analytics",
              testId: "nav-analytics",
            },
          ]
        : []),
      {
        to: "/dashboard/notifications",
        icon: Bell,
        label: "Notifications",
        badge: 0,
        testId: "nav-notifications",
      },
    ],
    [isAdminOrManager, pendingCount]
  );

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const roleBadge = {
    admin: "bg-blue-100 text-blue-800",
    manager: "bg-violet-100 text-violet-800",
    reviewer: "bg-gray-100 text-gray-700",
  }[operator?.role] || "bg-gray-100 text-gray-700";

  return (
    <div className="flex h-screen w-screen bg-[rgb(var(--color-bg))]">
      {/* Mobile overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-[rgb(var(--color-border))] bg-white transition-transform lg:relative lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link to="/dashboard" className="text-lg font-semibold tracking-tight">
            SmartClix
          </Link>
          <button
            className="rounded p-1 hover:bg-gray-100 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2" data-testid="primary-nav">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="border-t border-[rgb(var(--color-border))] p-3 space-y-1">
          <NavItem
            to="/dashboard/settings"
            icon={Settings}
            label="Settings"
            testId="nav-settings"
          />
          <button
            data-testid="sidebar-logout-btn"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-[rgb(var(--color-text))] hover:bg-gray-100"
          >
            <LogOut size={18} strokeWidth={1.75} />
            Logout
          </button>
        </div>

        <div className="border-t border-[rgb(var(--color-border))] px-5 py-4">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
            Logged in as
          </p>
          <p
            data-testid="sidebar-operator-name"
            className="mt-1 truncate text-sm font-medium"
          >
            {operator?.name || operator?.email}
          </p>
          <span
            data-testid="sidebar-operator-role"
            className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${roleBadge}`}
          >
            {operator?.role}
          </span>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-[rgb(var(--color-border))] bg-white px-4 lg:px-8">
          <button
            data-testid="mobile-menu-btn"
            className="rounded p-2 hover:bg-gray-100 lg:hidden"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="flex flex-1 items-center justify-end gap-3">
            <button
              data-testid="header-bell-btn"
              className="relative rounded-md p-2 hover:bg-gray-100"
              onClick={() => navigate("/dashboard/notifications")}
              aria-label="Notifications"
            >
              <Bell size={18} strokeWidth={1.75} />
            </button>

            <div className="relative">
              <button
                data-testid="header-avatar-btn"
                onClick={() => setMenuOpen((s) => !s)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-100"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgb(var(--color-primary))] text-xs font-medium text-white">
                  {(operator?.name || operator?.email || "?").charAt(0).toUpperCase()}
                </div>
                <span className="hidden text-sm sm:inline">
                  {operator?.name || operator?.email}
                </span>
                <ChevronDown size={14} />
              </button>
              {menuOpen && (
                <div
                  data-testid="avatar-dropdown"
                  className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-[rgb(var(--color-border))] bg-white shadow-lg"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <Link
                    to="/dashboard/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    <UserCircle size={16} /> My Profile
                  </Link>
                  <Link
                    to="/dashboard/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    <Settings size={16} /> Settings
                  </Link>
                  <button
                    data-testid="avatar-logout-btn"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 border-t border-[rgb(var(--color-border))] px-3 py-2 text-sm text-[rgb(var(--color-danger))] hover:bg-gray-100"
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8" data-testid="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
