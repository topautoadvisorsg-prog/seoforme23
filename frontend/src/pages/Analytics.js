import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div data-testid="analytics-page" className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
          Cross-client performance overview.
        </p>
      </header>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[rgb(var(--color-border))] bg-white py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[rgb(var(--color-primary))]">
          <BarChart3 size={26} />
        </div>
        <h2 className="text-base font-semibold">Analytics — Coming in Phase 6</h2>
        <p className="mt-2 max-w-md text-sm text-[rgb(var(--color-text-muted))]">
          Rankings, social, ads, and GBP insights will be displayed here once snapshots flow in
          from the Cowork webhook.
        </p>
      </div>
    </div>
  );
}
