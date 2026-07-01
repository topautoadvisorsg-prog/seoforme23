import { useEffect, useState } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { Inbox, SlidersHorizontal, ListChecks, CircleDot } from "lucide-react";
import { onboardingService } from "@/services/onboardingService";
import { clientsService } from "@/services/clientsService";

const SERVICE_LABELS = {
  seo: "SEO", gbp: "GBP", social: "Social", meta_ads: "Meta Ads",
  google_ads: "Google Ads", lsa: "LSA", linkedin_ads: "LinkedIn", video: "Video",
};

const ACTION_LABEL = {
  "approval.approved": "approved",
  "approval.rejected": "rejected",
};

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Stat({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="rounded-xl border border-[rgb(var(--color-border))] bg-white p-5">
      <div className="flex items-center gap-2 text-[rgb(var(--color-text-muted))]">
        <Icon size={15} />
        <p className="text-[11px] font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {sub && <p className={`mt-1 text-xs ${accent || "text-[rgb(var(--color-text-muted))]"}`}>{sub}</p>}
    </div>
  );
}

export default function ClientDashboard() {
  const { client, pending } = useOutletContext();
  const [onboarding, setOnboarding] = useState(null);
  const [activity, setActivity] = useState(null);

  useEffect(() => {
    onboardingService.list(client.id).then(setOnboarding).catch(() => setOnboarding(null));
    clientsService.activity(client.id).then(setActivity).catch(() => setActivity([]));
  }, [client.id]);

  const activeServices = Object.entries(client.services || {}).filter(([, on]) => on);
  const obPct = onboarding && onboarding.total_count
    ? Math.round((onboarding.completed_count / onboarding.total_count) * 100)
    : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
        <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
          Workspace dashboard · {client.industry || "—"}{client.location?.city ? ` · ${client.location.city}` : ""}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          icon={Inbox}
          label="Pending Approvals"
          value={pending}
          sub={pending > 0 ? "Awaiting review" : "All caught up"}
          accent={pending > 0 ? "text-[rgb(var(--color-warning))]" : "text-[rgb(var(--color-success))]"}
        />
        <Stat icon={SlidersHorizontal} label="Active Services" value={activeServices.length} sub={`${activeServices.length} of 8 enabled`} />
        <Stat
          icon={ListChecks}
          label="Onboarding"
          value={obPct == null ? "—" : obPct === 100 ? "Ready" : `${obPct}%`}
          sub={onboarding ? `${onboarding.completed_count}/${onboarding.total_count} steps` : "—"}
          accent={obPct === 100 ? "text-[rgb(var(--color-success))]" : undefined}
        />
        <Stat icon={CircleDot} label="Status" value={<span className="capitalize">{client.status}</span>} sub="Client state" />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent activity */}
        <section className="rounded-xl border border-[rgb(var(--color-border))] bg-white p-6 lg:col-span-2">
          <h3 className="text-base font-semibold">Recent Activity</h3>
          {activity === null ? (
            <div className="mt-4 space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-8 w-full" />)}</div>
          ) : activity.length === 0 ? (
            <p className="mt-4 py-6 text-center text-sm text-[rgb(var(--color-text-muted))]">
              No activity yet. Approvals and agent runs will appear here.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[rgb(var(--color-border))]">
              {activity.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span>
                    <span className="capitalize text-[rgb(var(--color-text-muted))]">{a.actor}</span>{" "}
                    {ACTION_LABEL[a.action] || a.action}{" "}
                    <span className="text-[rgb(var(--color-text-muted))]">
                      {a.details?.title || a.details?.item_type || a.target_type}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-[rgb(var(--color-text-muted))]">{timeAgo(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Active services */}
        <section className="rounded-xl border border-[rgb(var(--color-border))] bg-white p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Active Services</h3>
            <Link to="../services" className="text-xs text-[rgb(var(--color-primary))] hover:underline">Manage</Link>
          </div>
          {activeServices.length === 0 ? (
            <p className="mt-3 text-sm text-[rgb(var(--color-text-muted))]">
              No services enabled. Open Services to activate modules.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {activeServices.map(([k]) => (
                <span key={k} className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-[rgb(var(--color-primary))]">
                  ● {SERVICE_LABELS[k] || k}
                </span>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
