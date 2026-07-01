import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, CheckSquare, ListChecks, DollarSign, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { clientsService } from "@/services/clientsService";
import { approvalsService } from "@/services/approvalsService";
import { typeMeta } from "@/pages/approvals/itemTypes";

function SummaryCard({ icon: Icon, label, value, sub, accent, testId }) {
  return (
    <div data-testid={testId} className="rounded-xl border border-[rgb(var(--color-border))] bg-white p-6">
      <div className="flex items-center gap-2 text-[rgb(var(--color-text-muted))]">
        <Icon size={15} />
        <p className="text-[11px] font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      {sub && <p className={`mt-2 text-xs ${accent || "text-[rgb(var(--color-text-muted))]"}`}>{sub}</p>}
    </div>
  );
}

export default function OverviewPage() {
  const { operator } = useAuth();
  const navigate = useNavigate();
  const greetingName = (operator?.name || operator?.email || "operator").split(" ")[0];
  const hour = new Date().getHours();
  const period = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

  const [clients, setClients] = useState(null);
  const [pending, setPending] = useState(null);

  useEffect(() => {
    clientsService.list().then(setClients).catch(() => setClients([]));
    approvalsService.list({ status: "pending" }).then((d) => setPending(d.items)).catch(() => setPending([]));
  }, []);

  const list = clients || [];
  const activeCount = list.filter((c) => c.status === "active").length;
  const needsOnboarding = list.filter((c) => !c.onboarding_complete).length;
  const pendingCount = pending?.length ?? 0;

  return (
    <div data-testid="overview-page" className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Good {period}, {greetingName}</h1>
        <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">Here&apos;s the pulse across your portfolio.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          testId="card-active-clients" icon={Users} label="Active Clients"
          value={clients === null ? "—" : activeCount}
          sub={clients === null ? "" : `${list.length} total`}
        />
        <SummaryCard
          testId="card-pending-approvals" icon={CheckSquare} label="Pending Approvals"
          value={pending === null ? "—" : pendingCount}
          sub={pendingCount > 0 ? "Awaiting review" : "All caught up"}
          accent={pendingCount > 0 ? "text-[rgb(var(--color-warning))]" : "text-[rgb(var(--color-success))]"}
        />
        <SummaryCard
          testId="card-needs-onboarding" icon={ListChecks} label="Needs Onboarding"
          value={clients === null ? "—" : needsOnboarding}
          sub={needsOnboarding > 0 ? "Setup incomplete" : "All set up"}
          accent={needsOnboarding > 0 ? "text-[rgb(var(--color-warning))]" : "text-[rgb(var(--color-success))]"}
        />
        <SummaryCard
          testId="card-month-spend" icon={DollarSign} label="This Month Est. Spend"
          value="—" sub="Tracking in Phase 6"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Needs attention = real pending approvals */}
        <div data-testid="needs-attention" className="rounded-xl border border-[rgb(var(--color-border))] bg-white p-6 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Needs Your Attention</h2>
            {pendingCount > 0 && (
              <Link to="/dashboard/approvals" className="text-xs text-[rgb(var(--color-primary))] hover:underline">View all</Link>
            )}
          </div>
          {pending === null ? (
            <div className="mt-4 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)}</div>
          ) : pendingCount === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-[rgb(var(--color-success))]"><CheckSquare size={22} /></div>
              <p className="text-sm font-medium">You&apos;re all caught up</p>
              <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">New content appears here when agents complete tasks.</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {pending.slice(0, 6).map((it) => {
                const tm = typeMeta(it.item_type);
                return (
                  <li key={it.id}>
                    <Link to="/dashboard/approvals" className="flex items-center gap-3 rounded-lg border border-[rgb(var(--color-border))] px-3 py-2.5 hover:border-[rgb(var(--color-primary))] hover:bg-blue-50/30">
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${tm.color}`}>{tm.label}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{it.title}</span>
                        <span className="text-xs text-[rgb(var(--color-text-muted))]">{it.client_name}</span>
                      </span>
                      <ChevronRight size={15} className="shrink-0 text-[rgb(var(--color-text-muted))]" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Your clients quick access */}
        <div data-testid="your-clients" className="rounded-xl border border-[rgb(var(--color-border))] bg-white p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Clients</h2>
            <Link to="/dashboard/clients" className="text-xs text-[rgb(var(--color-primary))] hover:underline">All clients</Link>
          </div>
          {clients === null ? (
            <div className="mt-4 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 w-full" />)}</div>
          ) : list.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[rgb(var(--color-primary))]"><Users size={22} /></div>
              <p className="text-sm font-medium">No clients yet</p>
              <button onClick={() => navigate("/dashboard/clients")} className="mt-3 rounded-md bg-[rgb(var(--color-primary))] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">Add a client</button>
            </div>
          ) : (
            <ul className="mt-4 space-y-1">
              {list.slice(0, 7).map((c) => (
                <li key={c.id}>
                  <button onClick={() => navigate(`/dashboard/clients/${c.id}`)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-50">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--color-primary))] text-[11px] font-semibold text-white">{c.name.charAt(0).toUpperCase()}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
                    <span className="shrink-0 text-[10px] capitalize text-[rgb(var(--color-text-muted))]">{c.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
