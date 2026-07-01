import { useState } from "react";
import { toast } from "sonner";
import { workspaceService } from "@/services/workspaceService";
import { formatApiError } from "@/lib/api";

const MODULES = [
  {
    key: "seo",
    title: "MODULE A — SEO",
    desc: "Blog content, rankings, technical audits, citations, reviews, backlinks",
  },
  {
    key: "gbp",
    title: "MODULE B — GOOGLE BUSINESS PROFILE",
    desc: "GBP posts, review responses, Q&A, profile health",
  },
  {
    key: "social",
    title: "MODULE C — SOCIAL MEDIA",
    desc: "Instagram, Facebook, LinkedIn, X — weekly content batches",
    nested: [
      {
        key: "video",
        title: "└ VIDEO",
        desc: "Short clips, Reels, video ads",
      },
    ],
  },
  {
    key: "meta_ads",
    title: "MODULE D — META ADS",
    desc: "Facebook + Instagram ads, daily monitoring",
  },
  {
    key: "google_ads",
    title: "MODULE E — GOOGLE ADS",
    desc: "Search + Display campaigns, daily monitoring",
    nested: [
      {
        key: "lsa",
        title: "└ GOOGLE LSA",
        desc: "Pay-per-lead (local clients only)",
      },
    ],
  },
  {
    key: "linkedin_ads",
    title: "MODULE F — LINKEDIN ADS",
    desc: "B2B clients only — optional",
  },
];

function Toggle({ on, onChange, disabled, testId }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={on}
      data-testid={testId}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-[rgb(var(--color-primary))]" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          on ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function ModuleCard({ module, services, onToggle, busy, indent = false }) {
  const on = services[module.key];
  return (
    <div
      data-testid={`module-${module.key}`}
      className={`rounded-xl border border-[rgb(var(--color-border))] bg-white p-5 ${
        indent ? "ml-8" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text))]">
            {module.title}
          </p>
          <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">
            {module.desc}
          </p>
        </div>
        <Toggle
          on={on}
          onChange={() => onToggle(module.key, !on)}
          disabled={busy}
          testId={`toggle-${module.key}`}
        />
      </div>
    </div>
  );
}

export default function ServicesTab({ client, onClientChange, canEdit }) {
  const [busy, setBusy] = useState(false);
  const services = client.services || {};

  const toggle = async (key, next) => {
    if (!canEdit) {
      toast.error("Only admin/manager can toggle services");
      return;
    }
    if (!next) {
      const ok = window.confirm(
        `Disable ${key}? Active Cowork scheduled tasks for this service will need to be paused manually.`
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      await workspaceService.toggleServices(client.id, { [key]: next });
      toast.success(`${key} ${next ? "enabled" : "disabled"}`);
      onClientChange();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="services-tab" className="space-y-3">
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        Toggle service modules on or off. Enabling a service generates the
        onboarding checklist for that service.
      </p>
      {MODULES.map((m) => (
        <div key={m.key} className="space-y-3">
          <ModuleCard
            module={m}
            services={services}
            onToggle={toggle}
            busy={busy}
          />
          {m.nested?.map((sub) => (
            <ModuleCard
              key={sub.key}
              module={sub}
              services={services}
              onToggle={toggle}
              busy={busy}
              indent
            />
          ))}
        </div>
      ))}
    </div>
  );
}
