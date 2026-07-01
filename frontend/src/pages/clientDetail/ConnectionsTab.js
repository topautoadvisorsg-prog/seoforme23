import { useEffect, useState } from "react";
import { Eye, EyeOff, RotateCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { connectionsService } from "@/services/connectionsService";
import { formatApiError } from "@/lib/api";

const STATUS_BADGE = {
  connected: { color: "bg-green-100 text-green-800", dot: "bg-green-500", label: "Connected" },
  not_configured: {
    color: "bg-gray-100 text-gray-700",
    dot: "bg-gray-400",
    label: "Not Configured",
  },
  expiring_soon: {
    color: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
    label: "Expiring Soon",
  },
  expired: { color: "bg-red-100 text-red-800", dot: "bg-red-500", label: "Expired" },
  needs_reconnect: {
    color: "bg-red-100 text-red-800",
    dot: "bg-red-500",
    label: "Needs Reconnect",
  },
};

function FieldInput({ field, value, onChange, showSecrets }) {
  if (field.type === "checkboxes") {
    const current = Array.isArray(value) ? value : [];
    return (
      <div className="flex flex-wrap gap-3">
        {field.options.map((opt) => (
          <label
            key={opt}
            className="flex items-center gap-2 text-sm capitalize"
          >
            <input
              type="checkbox"
              checked={current.includes(opt)}
              onChange={(e) => {
                onChange(
                  e.target.checked
                    ? [...current, opt]
                    : current.filter((v) => v !== opt)
                );
              }}
              className="h-4 w-4 rounded border-[rgb(var(--color-border))] text-[rgb(var(--color-primary))]"
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }
  return (
    <input
      type={field.secret && !showSecrets ? "password" : "text"}
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      data-testid={`conn-field-${field.key}`}
      className="focus-ring h-10 w-full rounded-md border border-[rgb(var(--color-border))] px-3 text-sm"
    />
  );
}

function ConnectionCard({ clientId, conn, canEdit, onSaved }) {
  const status = STATUS_BADGE[conn.status] || STATUS_BADGE.not_configured;
  const [editing, setEditing] = useState(conn.status === "not_configured");
  const [showSecrets, setShowSecrets] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => {
    const out = {};
    for (const f of conn.fields_spec) {
      if (f.type === "checkboxes") {
        out[f.key] = Array.isArray(conn.display_fields?.[f.key])
          ? conn.display_fields[f.key]
          : [];
      } else {
        out[f.key] = f.secret ? "" : conn.display_fields?.[f.key] || "";
      }
    }
    return out;
  });

  const save = async () => {
    setBusy(true);
    try {
      // For secret fields that are blank, omit them so the existing value isn't overwritten
      const payload = { ...form };
      for (const f of conn.fields_spec) {
        if (f.secret && !payload[f.key]) delete payload[f.key];
      }
      await connectionsService.upsert(clientId, conn.service_name, payload);
      toast.success(`${conn.label} saved`);
      setEditing(false);
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try {
      const res = await connectionsService.test(clientId, conn.service_name);
      toast.success(`Connection OK (Phase 2 stub — ${res.field_count} fields decrypted)`);
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Remove ${conn.label} credentials?`)) return;
    setBusy(true);
    try {
      await connectionsService.remove(clientId, conn.service_name);
      toast.success("Connection removed");
      onSaved();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid={`connection-${conn.service_name}`}
      className="rounded-xl border border-[rgb(var(--color-border))] bg-white"
    >
      <header className="flex items-center justify-between border-b border-[rgb(var(--color-border))] px-5 py-4">
        <div>
          <h3 className="font-semibold">{conn.label}</h3>
          {conn.token_last_verified && (
            <p className="mt-1 text-[11px] text-[rgb(var(--color-text-muted))]">
              Last verified: {new Date(conn.token_last_verified).toLocaleString()}
            </p>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${status.color}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </header>
      <div className="space-y-4 p-5">
        {conn.fields_spec.map((field) => (
          <div key={field.key}>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
                {field.label}
              </label>
              {field.secret && editing && (
                <button
                  type="button"
                  onClick={() => setShowSecrets((s) => !s)}
                  className="text-xs text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
                >
                  {showSecrets ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              )}
            </div>
            {editing ? (
              <FieldInput
                field={field}
                value={form[field.key]}
                onChange={(v) => setForm((s) => ({ ...s, [field.key]: v }))}
                showSecrets={showSecrets}
              />
            ) : (
              <div className="rounded-md border border-[rgb(var(--color-border))] bg-gray-50 px-3 py-2 text-sm">
                {field.type === "checkboxes" ? (
                  Array.isArray(conn.display_fields?.[field.key]) &&
                  conn.display_fields[field.key].length > 0 ? (
                    conn.display_fields[field.key].join(", ")
                  ) : (
                    <span className="text-[rgb(var(--color-text-muted))]">—</span>
                  )
                ) : (
                  <span className="mono">
                    {conn.display_fields?.[field.key] || (
                      <span className="text-[rgb(var(--color-text-muted))]">—</span>
                    )}
                  </span>
                )}
              </div>
            )}
            {field.secret && editing && conn.id && (
              <p className="mt-1 text-[10px] text-[rgb(var(--color-text-muted))]">
                Leave blank to keep the existing value.
              </p>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[rgb(var(--color-border))] px-5 py-3">
          {editing ? (
            <>
              {conn.id && (
                <button
                  onClick={() => setEditing(false)}
                  disabled={busy}
                  className="h-9 rounded-md border border-[rgb(var(--color-border))] px-3 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={save}
                disabled={busy}
                data-testid={`conn-save-${conn.service_name}`}
                className="h-9 rounded-md bg-[rgb(var(--color-primary))] px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={remove}
                disabled={busy}
                className="flex h-9 items-center gap-1.5 rounded-md border border-[rgb(var(--color-border))] px-3 text-sm text-[rgb(var(--color-danger))] hover:bg-red-50"
              >
                <Trash2 size={12} /> Remove
              </button>
              <button
                onClick={test}
                disabled={busy}
                data-testid={`conn-test-${conn.service_name}`}
                className="flex h-9 items-center gap-1.5 rounded-md border border-[rgb(var(--color-border))] px-3 text-sm hover:bg-gray-50"
              >
                <RotateCw size={12} /> Test
              </button>
              <button
                onClick={() => setEditing(true)}
                data-testid={`conn-edit-${conn.service_name}`}
                className="h-9 rounded-md bg-[rgb(var(--color-primary))] px-4 text-sm font-medium text-white hover:bg-blue-700"
              >
                Edit
              </button>
            </>
          )}
        </footer>
      )}
    </div>
  );
}

export default function ConnectionsTab({ client, canEdit }) {
  const [data, setData] = useState(null);

  const load = async () => {
    try {
      setData(await connectionsService.list(client.id));
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  useEffect(() => {
    load();
  }, [client.id]);

  if (!data) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="skeleton h-32 w-full" />
        ))}
      </div>
    );
  }

  if (data.connections.length === 0) {
    return (
      <div
        data-testid="connections-empty"
        className="rounded-xl border border-dashed border-[rgb(var(--color-border))] bg-white p-12 text-center"
      >
        <p className="text-sm font-medium">No connections required yet</p>
        <p className="mt-2 text-xs text-[rgb(var(--color-text-muted))]">
          Enable services in the Services tab — MCP credential fields will
          appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="connections-tab" className="space-y-5">
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        Manage API credentials for each active service. All values are
        encrypted at rest. Secrets are never displayed in plaintext after save.
      </p>
      {data.connections.map((conn) => (
        <ConnectionCard
          key={conn.service_name}
          clientId={client.id}
          conn={conn}
          canEdit={canEdit}
          onSaved={load}
        />
      ))}
    </div>
  );
}
