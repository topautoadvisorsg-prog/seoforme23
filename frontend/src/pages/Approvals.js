import { useCallback, useEffect, useState } from "react";
import { CheckSquare, Flag, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { approvalsService } from "@/services/approvalsService";
import { formatApiError } from "@/lib/api";
import { useApprovalsSocket } from "@/hooks/useApprovalsSocket";
import ReviewModal from "./approvals/ReviewModal";
import { typeMeta, statusMeta, ITEM_TYPE_META } from "./approvals/itemTypes";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "flagged", label: "Flagged" },
  { key: "stale", label: "Stale" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function ApprovalsPage() {
  const [tab, setTab] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("");
  const [items, setItems] = useState(null);
  const [counts, setCounts] = useState({});
  const [flaggedCount, setFlaggedCount] = useState(0);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    const params = {};
    if (tab === "flagged") params.flagged = true;
    else if (tab !== "all") params.status = tab;
    if (typeFilter) params.item_type = typeFilter;
    try {
      const data = await approvalsService.list(params);
      setItems(data.items);
      setCounts(data.counts || {});
      const f = await approvalsService.list({ flagged: true });
      setFlaggedCount(f.items.length);
      window.dispatchEvent(new Event("approvals:changed"));
    } catch (e) {
      toast.error(formatApiError(e));
      setItems([]);
    }
  }, [tab, typeFilter]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  useApprovalsSocket(
    useCallback((msg) => {
      if (msg?.type?.startsWith("approval")) load();
    }, [load])
  );

  const tabCount = (key) =>
    key === "flagged" ? flaggedCount : key === "all" ? counts.all : counts[key];

  const onChanged = () => {
    setSelected(null);
    load();
  };

  return (
    <div data-testid="approvals-page" className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Approval Queue</h1>
        <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
          Review and approve agent-generated content before it executes.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgb(var(--color-border))]">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              data-testid={`tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors ${
                tab === t.key
                  ? "border-[rgb(var(--color-primary))] font-medium text-[rgb(var(--color-primary))]"
                  : "border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
              }`}
            >
              {t.label}
              {tabCount(t.key) > 0 && (
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-[rgb(var(--color-text-muted))]">
                  {tabCount(t.key)}
                </span>
              )}
            </button>
          ))}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          data-testid="type-filter"
          className="focus-ring mb-1 h-9 rounded-md border border-[rgb(var(--color-border))] bg-white px-3 text-sm"
        >
          <option value="">All types</option>
          {Object.entries(ITEM_TYPE_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      {items === null ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[rgb(var(--color-border))] bg-white py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-[rgb(var(--color-success))]">
            <CheckSquare size={26} />
          </div>
          <h2 className="text-base font-semibold">Nothing here</h2>
          <p className="mt-2 max-w-md text-sm text-[rgb(var(--color-text-muted))]">
            No {tab === "all" ? "" : tab} items{typeFilter ? " of this type" : ""}. New items
            arrive automatically when agents complete their tasks.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const tm = typeMeta(it.item_type);
            const sm = statusMeta(it.status);
            return (
              <button
                key={it.id}
                data-testid={`approval-row-${it.id}`}
                onClick={() => setSelected(it)}
                className="flex w-full items-center gap-4 rounded-xl border border-[rgb(var(--color-border))] bg-white px-4 py-3 text-left transition-colors hover:border-[rgb(var(--color-primary))] hover:bg-blue-50/30"
              >
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${tm.color}`}>
                  {tm.label}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{it.title}</p>
                    {it.flagged && <Flag size={13} className="shrink-0 text-[rgb(var(--color-warning))]" />}
                  </div>
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">
                    {it.client_name} · {timeAgo(it.created_at)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${sm.color}`}>
                  {sm.label}
                </span>
                <ChevronRight size={16} className="shrink-0 text-[rgb(var(--color-text-muted))]" />
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <ReviewModal item={selected} onClose={() => setSelected(null)} onChanged={onChanged} />
      )}
    </div>
  );
}
