import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { operatorsService } from "@/services/operatorsService";
import { formatApiError } from "@/lib/api";
import { Mail, Users as UsersIcon, Bell, KeyRound, Plus, Trash2 } from "lucide-react";

function Tabs({ tabs, current, onChange }) {
  return (
    <div className="border-b border-[rgb(var(--color-border))]">
      <div className="-mb-px flex gap-6 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            data-testid={`settings-tab-${t.id}`}
            onClick={() => onChange(t.id)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-sm transition-colors ${
              current === t.id
                ? "border-[rgb(var(--color-primary))] text-[rgb(var(--color-primary))]"
                : "border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileTab() {
  const { operator } = useAuth();
  return (
    <div data-testid="profile-tab" className="max-w-lg space-y-5">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
          Full Name
        </label>
        <input
          defaultValue={operator?.name}
          className="focus-ring h-10 w-full rounded-md border border-[rgb(var(--color-border))] px-3 text-sm"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
          Email
        </label>
        <input
          readOnly
          value={operator?.email || ""}
          className="h-10 w-full rounded-md border border-[rgb(var(--color-border))] bg-gray-50 px-3 text-sm text-[rgb(var(--color-text-muted))]"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
          Role
        </label>
        <span className="inline-block rounded bg-gray-100 px-2 py-1 text-xs font-medium capitalize">
          {operator?.role}
        </span>
      </div>
      <p className="text-xs text-[rgb(var(--color-text-muted))]">
        Profile save + password change wire up in Phase 8.
      </p>
    </div>
  );
}

function TeamTab() {
  const { operator: me } = useAuth();
  const [operators, setOperators] = useState(null);
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    name: "",
    role: "reviewer",
    password: "",
  });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setOperators(await operatorsService.list());
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitInvite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await operatorsService.create(inviteForm);
      setInviteForm({ email: "", name: "", role: "reviewer", password: "" });
      setShowInvite(false);
      load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this operator? This cannot be undone.")) return;
    try {
      await operatorsService.remove(id);
      load();
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  return (
    <div data-testid="team-tab" className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Team Members</h2>
          <p className="text-sm text-[rgb(var(--color-text-muted))]">
            Invite operators and manage their access.
          </p>
        </div>
        <button
          onClick={() => setShowInvite((s) => !s)}
          data-testid="team-invite-btn"
          className="flex items-center gap-2 rounded-md bg-[rgb(var(--color-primary))] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} /> Invite Operator
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-[rgb(var(--color-danger))] bg-red-50 px-3 py-2 text-sm text-[rgb(var(--color-danger))]">
          {error}
        </div>
      )}

      {showInvite && (
        <form
          onSubmit={submitInvite}
          data-testid="team-invite-form"
          className="grid grid-cols-1 gap-4 rounded-xl border border-[rgb(var(--color-border))] bg-white p-5 sm:grid-cols-2"
        >
          <input
            required
            placeholder="Email"
            type="email"
            data-testid="invite-email"
            value={inviteForm.email}
            onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            className="focus-ring h-10 rounded-md border border-[rgb(var(--color-border))] px-3 text-sm"
          />
          <input
            required
            placeholder="Full Name"
            data-testid="invite-name"
            value={inviteForm.name}
            onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
            className="focus-ring h-10 rounded-md border border-[rgb(var(--color-border))] px-3 text-sm"
          />
          <select
            data-testid="invite-role"
            value={inviteForm.role}
            onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
            className="focus-ring h-10 rounded-md border border-[rgb(var(--color-border))] bg-white px-3 text-sm"
          >
            <option value="admin">Admin — Full access</option>
            <option value="manager">Manager — All clients, full ops</option>
            <option value="reviewer">Reviewer — Assigned clients only</option>
          </select>
          <input
            required
            placeholder="Temporary Password (min 8 chars)"
            type="text"
            data-testid="invite-password"
            value={inviteForm.password}
            onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
            className="focus-ring h-10 rounded-md border border-[rgb(var(--color-border))] px-3 text-sm"
          />
          <div className="col-span-full flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="h-10 rounded-md border border-[rgb(var(--color-border))] px-4 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              data-testid="invite-submit"
              className="h-10 rounded-md bg-[rgb(var(--color-primary))] px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send Invite"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-[rgb(var(--color-border))] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Last Login</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {operators === null ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="border-t border-[rgb(var(--color-border))]">
                  <td className="px-4 py-3"><div className="skeleton h-3 w-32" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-3 w-48" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-3 w-16" /></td>
                  <td className="px-4 py-3"><div className="skeleton h-3 w-24" /></td>
                  <td className="px-4 py-3"></td>
                </tr>
              ))
            ) : operators.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[rgb(var(--color-text-muted))]">
                  No operators yet.
                </td>
              </tr>
            ) : (
              operators.map((op) => (
                <tr
                  key={op.id}
                  data-testid={`operator-row-${op.id}`}
                  className="border-t border-[rgb(var(--color-border))] hover:bg-blue-50/30"
                >
                  <td className="px-4 py-3 font-medium">{op.name}</td>
                  <td className="px-4 py-3 text-[rgb(var(--color-text-muted))]">{op.email}</td>
                  <td className="px-4 py-3 capitalize">{op.role}</td>
                  <td className="px-4 py-3 text-[rgb(var(--color-text-muted))]">
                    {op.last_login ? new Date(op.last_login).toLocaleString() : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {op.id !== me?.id && (
                      <button
                        onClick={() => remove(op.id)}
                        data-testid={`operator-delete-${op.id}`}
                        className="rounded p-1.5 text-[rgb(var(--color-text-muted))] hover:bg-red-50 hover:text-[rgb(var(--color-danger))]"
                        aria-label="Remove operator"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmailConfigTab() {
  return (
    <div data-testid="email-config-tab" className="max-w-lg space-y-4">
      <h2 className="text-lg font-semibold">Email Configuration</h2>
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        Resend integration ships in Phase 5. Add your API key here to enable transactional emails
        (password reset, token alerts, approval reminders).
      </p>
      <div className="rounded-md border border-dashed border-[rgb(var(--color-border))] bg-gray-50 p-4 text-sm text-[rgb(var(--color-text-muted))]">
        Status: <span className="font-medium">Not configured</span> — password reset links are
        currently logged to backend console for development.
      </div>
    </div>
  );
}

function PreferencesTab() {
  return (
    <div data-testid="prefs-tab" className="max-w-lg space-y-3">
      <h2 className="text-lg font-semibold">Notification Preferences</h2>
      <p className="text-sm text-[rgb(var(--color-text-muted))]">
        Per-event toggles for in-app vs email ship with Phase 7 (Notifications Center).
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const { operator } = useAuth();
  const isAdmin = operator?.role === "admin";
  const tabs = [
    { id: "profile", label: "My Profile", icon: UsersIcon },
    ...(isAdmin
      ? [
          { id: "team", label: "Team", icon: UsersIcon },
          { id: "email", label: "Email Configuration", icon: Mail },
        ]
      : []),
    { id: "prefs", label: "Notification Preferences", icon: Bell },
  ];
  const [current, setCurrent] = useState("profile");

  return (
    <div data-testid="settings-page" className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>
      <Tabs tabs={tabs} current={current} onChange={setCurrent} />
      <div className="pt-2">
        {current === "profile" && <ProfileTab />}
        {current === "team" && isAdmin && <TeamTab />}
        {current === "email" && isAdmin && <EmailConfigTab />}
        {current === "prefs" && <PreferencesTab />}
      </div>
    </div>
  );
}
