import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Activity as ActivityIcon } from "lucide-react";
import { clientsService } from "@/services/clientsService";

const ACTION_LABEL = {
  "approval.approved": "approved",
  "approval.rejected": "rejected",
};

export default function ActivityPage() {
  const { client } = useOutletContext();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    clientsService.activity(client.id, 100).then(setRows).catch(() => setRows([]));
  }, [client.id]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
        <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
          Audit trail of operator and agent actions for {client.name}.
        </p>
      </header>

      <div className="rounded-xl border border-[rgb(var(--color-border))] bg-white">
        {rows === null ? (
          <div className="space-y-2 p-6">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-8 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[rgb(var(--color-primary))]">
              <ActivityIcon size={24} />
            </div>
            <p className="text-sm font-medium">No activity yet</p>
            <p className="mt-2 max-w-md text-xs text-[rgb(var(--color-text-muted))]">
              Approvals, rejections, and agent runs for this client will be logged here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[rgb(var(--color-border))]">
            {rows.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="font-medium capitalize">{a.actor}</span>{" "}
                  {ACTION_LABEL[a.action] || a.action}{" "}
                  <span className="text-[rgb(var(--color-text-muted))]">
                    {a.details?.title || a.details?.item_type || a.target_type}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-[rgb(var(--color-text-muted))]">
                  {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
