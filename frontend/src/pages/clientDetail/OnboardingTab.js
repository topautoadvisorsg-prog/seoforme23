import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { onboardingService } from "@/services/onboardingService";
import { formatApiError } from "@/lib/api";

const SERVICE_HEADINGS = {
  common: "ALL SERVICES",
  seo: "SEO",
  gbp: "GBP",
  social: "SOCIAL MEDIA",
  meta_ads: "META ADS",
  google_ads: "GOOGLE ADS",
  lsa: "GOOGLE LSA",
  linkedin_ads: "LINKEDIN ADS",
  video: "VIDEO",
};

function groupItems(items) {
  const groups = {};
  for (const it of items) {
    if (!groups[it.service]) groups[it.service] = [];
    groups[it.service].push(it);
  }
  return groups;
}

export default function OnboardingTab({ clientId, onClientChange }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState({});

  const load = async () => {
    try {
      setData(await onboardingService.list(clientId));
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  useEffect(() => {
    load();
  }, [clientId]);

  const toggle = async (item) => {
    setBusy((s) => ({ ...s, [item.id]: true }));
    try {
      await onboardingService.setComplete(item.id, !item.completed);
      await load();
      onClientChange?.();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy((s) => ({ ...s, [item.id]: false }));
    }
  };

  if (!data) {
    return (
      <div data-testid="onboarding-tab" className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton h-8 w-full" />
        ))}
      </div>
    );
  }

  if (data.total_count === 0) {
    return (
      <div
        data-testid="onboarding-empty"
        className="rounded-xl border border-dashed border-[rgb(var(--color-border))] bg-white p-12 text-center"
      >
        <p className="text-sm font-medium">No services enabled yet</p>
        <p className="mt-2 text-xs text-[rgb(var(--color-text-muted))]">
          Go to the Services tab to enable modules. Checklist items will
          appear here automatically.
        </p>
      </div>
    );
  }

  const groups = groupItems(data.items);
  const groupOrder = ["common", ...Object.keys(groups).filter((g) => g !== "common")];
  const progress = data.total_count
    ? Math.round((data.completed_count / data.total_count) * 100)
    : 0;

  return (
    <div data-testid="onboarding-tab" className="space-y-6">
      <div className="rounded-xl border border-[rgb(var(--color-border))] bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Client Setup Checklist</h3>
            <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
              Complete all items before agents can run for this client.
            </p>
          </div>
          <div
            data-testid="onboarding-progress-label"
            className="text-sm font-medium"
          >
            {data.completed_count} of {data.total_count} complete
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            data-testid="onboarding-progress-bar"
            className={`h-full transition-all ${
              progress === 100
                ? "bg-[rgb(var(--color-success))]"
                : "bg-[rgb(var(--color-primary))]"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        {data.onboarding_complete && (
          <div
            data-testid="onboarding-complete-badge"
            className="mt-4 rounded-md border border-[rgb(var(--color-success))] bg-green-50 p-3 text-sm text-[rgb(var(--color-success))]"
          >
            ✅ All setup complete — agents can now run for this client.
          </div>
        )}
      </div>

      {groupOrder.map((service) => (
        <section
          key={service}
          data-testid={`onboarding-group-${service}`}
          className="rounded-xl border border-[rgb(var(--color-border))] bg-white"
        >
          <h4 className="border-b border-[rgb(var(--color-border))] px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
            {SERVICE_HEADINGS[service] || service}
          </h4>
          <ul className="divide-y divide-[rgb(var(--color-border))]">
            {groups[service].map((item) => (
              <li
                key={item.id}
                data-testid={`onboarding-item-${item.item_key}`}
                className="flex items-center gap-3 px-5 py-3"
              >
                <button
                  onClick={() => toggle(item)}
                  disabled={busy[item.id]}
                  data-testid={`onboarding-toggle-${item.item_key}`}
                  aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                    item.completed
                      ? "border-[rgb(var(--color-success))] bg-[rgb(var(--color-success))] text-white"
                      : "border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-primary))]"
                  }`}
                >
                  {item.completed && <Check size={12} strokeWidth={3} />}
                </button>
                <span
                  className={`flex-1 text-sm ${
                    item.completed
                      ? "text-[rgb(var(--color-text-muted))] line-through"
                      : ""
                  }`}
                >
                  {item.label}
                </span>
                {item.completed && item.completed_at && (
                  <span className="text-[10px] text-[rgb(var(--color-text-muted))]">
                    {new Date(item.completed_at).toLocaleDateString()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
