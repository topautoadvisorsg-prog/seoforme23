import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { clientsService } from "@/services/clientsService";
import { operatorsService } from "@/services/operatorsService";
import { formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

const SERVICE_BADGES = {
  seo: { label: "SEO", color: "bg-blue-100 text-blue-800" },
  gbp: { label: "GBP", color: "bg-emerald-100 text-emerald-800" },
  social: { label: "Social", color: "bg-violet-100 text-violet-800" },
  meta_ads: { label: "Meta Ads", color: "bg-pink-100 text-pink-800" },
  google_ads: { label: "Google Ads", color: "bg-amber-100 text-amber-800" },
  lsa: { label: "LSA", color: "bg-orange-100 text-orange-800" },
  linkedin_ads: { label: "LinkedIn", color: "bg-cyan-100 text-cyan-800" },
  video: { label: "Video", color: "bg-rose-100 text-rose-800" },
};

const STATUS_BADGE = {
  active: "bg-green-100 text-green-800",
  paused: "bg-amber-100 text-amber-800",
  churned: "bg-gray-200 text-gray-700",
};

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
        STATUS_BADGE[status] || STATUS_BADGE.active
      }`}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function NewClientPanel({ onClose, onCreated, operators }) {
  const [form, setForm] = useState({
    name: "",
    website_url: "",
    industry: "",
    location: { city: "", state: "", country: "" },
    assigned_to: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (path, val) => {
    if (path.includes(".")) {
      const [k1, k2] = path.split(".");
      setForm((s) => ({ ...s, [k1]: { ...s[k1], [k2]: val } }));
    } else {
      setForm((s) => ({ ...s, [path]: val }));
    }
  };

  const submit = async (e) => {
    if (e) e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = { ...form };
      if (!payload.assigned_to) delete payload.assigned_to;
      const created = await clientsService.create(payload);
      toast.success(`Client "${created.name}" created`);
      onCreated(created);
    } catch (err) {
      const msg = formatApiError(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="new-client-panel"
      className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[480px] flex-col border-l border-[rgb(var(--color-border))] bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-[rgb(var(--color-border))] px-6 py-4">
        <h2 className="text-base font-semibold">New Client</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 hover:bg-gray-100"
          aria-label="Close"
          data-testid="new-client-close"
        >
          <X size={18} />
        </button>
      </div>
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <div className="flex-1 space-y-5 overflow-auto p-6 pb-40">
          <Field label="Business Name *" testId="newc-name">
            <input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              data-testid="newc-name-input"
              className="focus-ring h-10 w-full rounded-md border border-[rgb(var(--color-border))] px-3 text-sm"
            />
          </Field>
          <Field label="Website URL">
            <input
              type="url"
              placeholder="https://"
              value={form.website_url}
              onChange={(e) => set("website_url", e.target.value)}
              data-testid="newc-website-input"
              className="focus-ring h-10 w-full rounded-md border border-[rgb(var(--color-border))] px-3 text-sm"
            />
          </Field>
          <Field label="Industry">
            <input
              value={form.industry}
              onChange={(e) => set("industry", e.target.value)}
              data-testid="newc-industry-input"
              className="focus-ring h-10 w-full rounded-md border border-[rgb(var(--color-border))] px-3 text-sm"
            />
          </Field>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
              Location
            </p>
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="City"
                value={form.location.city}
                onChange={(e) => set("location.city", e.target.value)}
                className="focus-ring h-10 rounded-md border border-[rgb(var(--color-border))] px-3 text-sm"
              />
              <input
                placeholder="State"
                value={form.location.state}
                onChange={(e) => set("location.state", e.target.value)}
                className="focus-ring h-10 rounded-md border border-[rgb(var(--color-border))] px-3 text-sm"
              />
              <input
                placeholder="Country"
                value={form.location.country}
                onChange={(e) => set("location.country", e.target.value)}
                className="focus-ring col-span-2 h-10 rounded-md border border-[rgb(var(--color-border))] px-3 text-sm"
              />
            </div>
          </div>
          <Field label="Assigned Operator">
            <select
              value={form.assigned_to}
              onChange={(e) => set("assigned_to", e.target.value)}
              data-testid="newc-operator-select"
              className="focus-ring h-10 w-full rounded-md border border-[rgb(var(--color-border))] bg-white px-3 text-sm"
            >
              <option value="">— None —</option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {`${op.name} (${op.role})`}
                </option>
              ))}
            </select>
          </Field>
          {error && (
            <div className="rounded-md border border-[rgb(var(--color-danger))] bg-red-50 px-3 py-2 text-sm text-[rgb(var(--color-danger))]">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-2 border-t border-[rgb(var(--color-border))] pt-5">
            <button
              type="submit"
              disabled={busy || !form.name}
              data-testid="newc-submit-btn"
              className="h-10 w-full rounded-md bg-[rgb(var(--color-primary))] text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? "Creating…" : "Create Client →"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-10 w-full rounded-md border border-[rgb(var(--color-border))] text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children, testId }) {
  return (
    <div data-testid={testId}>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function ClientsPage() {
  const { operator } = useAuth();
  const navigate = useNavigate();
  const isAdminOrManager = ["admin", "manager"].includes(operator?.role);
  const [clients, setClients] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [operators, setOperators] = useState([]);

  const load = async () => {
    try {
      setClients(await clientsService.list());
    } catch (e) {
      toast.error(formatApiError(e));
      setClients([]);
    }
  };

  useEffect(() => {
    load();
    if (isAdminOrManager) {
      operatorsService
        .list()
        .then(setOperators)
        .catch(() => setOperators([]));
    }
  }, [isAdminOrManager]);

  const visible = (clients || []).filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  const operatorName = (id) => {
    const op = operators.find((o) => o.id === id);
    return op?.name || "—";
  };

  return (
    <div data-testid="clients-page" className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
            All client workspaces you manage.
          </p>
        </div>
        {isAdminOrManager && (
          <button
            onClick={() => setShowNew(true)}
            data-testid="new-client-btn"
            className="flex items-center gap-2 rounded-md bg-[rgb(var(--color-primary))] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} /> New Client
          </button>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            data-testid="clients-search"
            className="focus-ring h-9 w-64 rounded-md border border-[rgb(var(--color-border))] pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          data-testid="clients-status-filter"
          className="focus-ring h-9 rounded-md border border-[rgb(var(--color-border))] bg-white px-3 text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="churned">Churned</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[rgb(var(--color-border))] bg-white">
        {clients === null ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-10 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[rgb(var(--color-primary))]">
              <Users size={26} />
            </div>
            <p className="text-sm font-medium">
              {clients.length === 0 ? "No clients yet" : "No clients match your filters"}
            </p>
            <p className="mt-2 max-w-md text-xs text-[rgb(var(--color-text-muted))]">
              {clients.length === 0
                ? "Create your first client to get started."
                : "Try clearing the search or status filter."}
            </p>
            {isAdminOrManager && clients.length === 0 && (
              <button
                onClick={() => setShowNew(true)}
                className="mt-4 flex items-center gap-2 rounded-md bg-[rgb(var(--color-primary))] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus size={14} /> Create Client
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Active Services</th>
                <th className="px-4 py-3">Operator</th>
                <th className="px-4 py-3">Onboarding</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr
                  key={c.id}
                  data-testid={`client-row-${c.id}`}
                  onClick={() => navigate(`/dashboard/clients/${c.id}`)}
                  className="cursor-pointer border-t border-[rgb(var(--color-border))] hover:bg-blue-50/40"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    {c.website_url && (
                      <div className="text-xs text-[rgb(var(--color-text-muted))]">
                        {c.website_url.replace(/^https?:\/\//, "")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(c.services || {})
                        .filter(([, on]) => on)
                        .map(([k]) => (
                          <span
                            key={k}
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${SERVICE_BADGES[k]?.color}`}
                          >
                            {SERVICE_BADGES[k]?.label || k}
                          </span>
                        ))}
                      {Object.values(c.services || {}).every((v) => !v) && (
                        <span className="text-xs text-[rgb(var(--color-text-muted))]">
                          —
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[rgb(var(--color-text-muted))]">
                    {operatorName(c.assigned_to)}
                  </td>
                  <td className="px-4 py-3">
                    {c.onboarding_complete ? (
                      <span className="text-xs font-medium text-[rgb(var(--color-success))]">
                        ✓ Ready
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-[rgb(var(--color-warning))]">
                        ⏱ Setup
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <NewClientPanel
          operators={operators}
          onClose={() => setShowNew(false)}
          onCreated={(c) => {
            setShowNew(false);
            navigate(`/dashboard/clients/${c.id}`);
          }}
        />
      )}
    </div>
  );
}
