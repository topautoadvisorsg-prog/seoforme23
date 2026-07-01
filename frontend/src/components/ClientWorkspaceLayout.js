import { useCallback, useEffect, useState } from "react";
import { Outlet, NavLink, Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, LayoutDashboard, Inbox, ListChecks, Activity as ActivityIcon,
  SlidersHorizontal, Plug, KeyRound, LogOut, Bell, Menu,
  Search, MapPin, Share2, Megaphone, Phone, Linkedin, Video,
  MoreVertical, Pause, Play, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { clientsService } from "@/services/clientsService";
import { approvalsService } from "@/services/approvalsService";
import { formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import WorkspaceIdModal from "@/pages/clientDetail/WorkspaceIdModal";

const STATUS_DOT = {
  active: "text-[rgb(var(--color-success))]",
  paused: "text-[rgb(var(--color-warning))]",
  churned: "text-[rgb(var(--color-text-muted))]",
};

const CHANNEL_META = {
  seo: { label: "SEO", icon: Search },
  gbp: { label: "Google Business", icon: MapPin },
  social: { label: "Social", icon: Share2 },
  meta_ads: { label: "Meta Ads", icon: Megaphone },
  google_ads: { label: "Google Ads", icon: Megaphone },
  lsa: { label: "Local Services Ads", icon: Phone },
  linkedin_ads: { label: "LinkedIn", icon: Linkedin },
  video: { label: "Video", icon: Video },
};

function Group({ label, children }) {
  return (
    <div className="py-2">
      <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Item({ to, end, icon: Icon, label, badge, testId }) {
  return (
    <NavLink
      to={to}
      end={end}
      data-testid={testId}
      className={({ isActive }) =>
        `flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
          isActive ? "nav-active font-medium" : "text-[rgb(var(--color-text))] hover:bg-gray-100"
        }`
      }
    >
      <span className="flex items-center gap-3">
        <Icon size={16} strokeWidth={1.75} /> {label}
      </span>
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-[rgb(var(--color-primary))] px-2 py-0.5 text-[10px] font-semibold text-white">
          {badge}
        </span>
      )}
    </NavLink>
  );
}

export default function ClientWorkspaceLayout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { operator, logout } = useAuth();
  const canEdit = ["admin", "manager"].includes(operator?.role);

  const [client, setClient] = useState(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState("");
  const [showWsId, setShowWsId] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const c = await clientsService.get(id);
      setClient(c);
      if (c.workspace_id) {
        const q = await approvalsService.list({ workspace_id: c.workspace_id, status: "pending" });
        setPending(q.items.length);
      }
    } catch (e) {
      setError(formatApiError(e));
    }
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  const setStatus = async (status) => {
    try {
      await clientsService.setStatus(id, status);
      toast.success(`Client ${status}`);
      setMenuOpen(false);
      reload();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const remove = async () => {
    if (!window.confirm("Permanently delete this client and ALL its data? Prefer Churn for graceful offboarding.")) return;
    try {
      await clientsService.remove(id);
      toast.success("Client deleted");
      navigate("/dashboard/clients", { replace: true });
    } catch (e) { toast.error(formatApiError(e)); }
  };

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[rgb(var(--color-bg))] p-8">
        <div className="rounded-xl border border-[rgb(var(--color-danger))] bg-red-50 p-6 text-sm text-[rgb(var(--color-danger))]">
          {error} — <Link to="/dashboard/clients" className="underline">Back to Clients</Link>
        </div>
      </div>
    );
  }

  const enabledChannels = Object.entries(client?.services || {}).filter(([, on]) => on);

  return (
    <div className="flex h-screen w-screen bg-[rgb(var(--color-bg))]">
      {mobileNavOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileNavOpen(false)} />
      )}
      {/* Client sidebar */}
      <aside
        data-testid="client-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-[rgb(var(--color-border))] bg-white transition-transform lg:relative lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link
          to="/dashboard/clients"
          className="flex items-center gap-2 px-5 py-4 text-xs text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
          data-testid="back-to-clients"
        >
          <ArrowLeft size={14} /> All Clients
        </Link>

        {/* client identity */}
        <div className="flex items-center gap-3 border-b border-[rgb(var(--color-border))] px-5 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--color-primary))] text-base font-semibold text-white">
            {(client?.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{client?.name || "…"}</p>
            <p className={`text-xs font-medium capitalize ${STATUS_DOT[client?.status] || ""}`}>
              ● {client?.status || ""}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2" data-testid="client-nav" onClick={() => setMobileNavOpen(false)}>
          <Group label="Workspace">
            <Item to="" end icon={LayoutDashboard} label="Dashboard" testId="cnav-dashboard" />
            <Item to="queue" icon={Inbox} label="Content Queue" badge={pending} testId="cnav-queue" />
            <Item to="onboarding" icon={ListChecks} label="Onboarding" testId="cnav-onboarding" />
            <Item to="activity" icon={ActivityIcon} label="Activity" testId="cnav-activity" />
          </Group>

          <Group label="Configuration">
            <Item to="services" icon={SlidersHorizontal} label="Services" testId="cnav-services" />
            <Item to="connections" icon={Plug} label="Connections" testId="cnav-connections" />
          </Group>

          <Group label="Channels">
            {enabledChannels.length === 0 ? (
              <p className="px-3 py-1 text-xs text-[rgb(var(--color-text-muted))]">
                No channels enabled. Turn on services to add them.
              </p>
            ) : (
              enabledChannels.map(([key]) => {
                const m = CHANNEL_META[key] || { label: key, icon: SlidersHorizontal };
                return (
                  <Item
                    key={key}
                    to={`channel/${key}`}
                    icon={m.icon}
                    label={m.label}
                    testId={`cnav-channel-${key}`}
                  />
                );
              })
            )}
          </Group>
        </nav>

        <div className="border-t border-[rgb(var(--color-border))] p-3">
          <button
            onClick={() => setShowWsId(true)}
            data-testid="view-workspace-id-btn"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-[rgb(var(--color-text))] hover:bg-gray-100"
          >
            <KeyRound size={16} strokeWidth={1.75} /> Workspace ID
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-[rgb(var(--color-border))] bg-white px-4 lg:px-8">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="rounded p-2 hover:bg-gray-100 lg:hidden"
            aria-label="Open client menu"
            data-testid="client-mobile-menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex flex-1 items-center justify-end gap-3">
            {canEdit && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((s) => !s)}
                  data-testid="client-menu-btn"
                  className="rounded-md border border-[rgb(var(--color-border))] p-2 hover:bg-gray-50"
                  aria-label="Client actions"
                >
                  <MoreVertical size={16} />
                </button>
                {menuOpen && (
                  <div
                    className="absolute right-0 top-full z-30 mt-1 w-48 rounded-md border border-[rgb(var(--color-border))] bg-white shadow-lg"
                    onMouseLeave={() => setMenuOpen(false)}
                  >
                    {client?.status === "active" ? (
                      <button onClick={() => setStatus("paused")} data-testid="client-pause-btn" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"><Pause size={14} /> Pause client</button>
                    ) : client?.status === "paused" ? (
                      <button onClick={() => setStatus("active")} data-testid="client-resume-btn" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"><Play size={14} /> Resume</button>
                    ) : null}
                    {client?.status !== "churned" && (
                      <button onClick={() => setStatus("churned")} data-testid="client-churn-btn" className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[rgb(var(--color-warning))] hover:bg-gray-50">Churn client</button>
                    )}
                    {operator?.role === "admin" && (
                      <button onClick={remove} data-testid="client-delete-btn" className="flex w-full items-center gap-2 border-t border-[rgb(var(--color-border))] px-3 py-2 text-sm text-[rgb(var(--color-danger))] hover:bg-red-50"><Trash2 size={14} /> Delete permanently</button>
                    )}
                  </div>
                )}
              </div>
            )}
            <button data-testid="header-bell-btn" onClick={() => navigate("/dashboard/notifications")} className="rounded-md p-2 hover:bg-gray-100" aria-label="Notifications">
              <Bell size={18} strokeWidth={1.75} />
            </button>
            <button onClick={logout} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-100" data-testid="ws-logout">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgb(var(--color-primary))] text-xs font-medium text-white">
                {(operator?.name || "?").charAt(0).toUpperCase()}
              </div>
              <LogOut size={14} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-8" data-testid="client-main">
          {client && <Outlet context={{ client, reload, canEdit, pending, refreshPending: reload }} />}
        </main>
      </div>

      {showWsId && client && (
        <WorkspaceIdModal workspaceId={client.workspace_id} onClose={() => setShowWsId(false)} />
      )}
    </div>
  );
}
