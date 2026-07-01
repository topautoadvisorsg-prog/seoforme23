import { useOutletContext } from "react-router-dom";
import ConnectionsTab from "@/pages/clientDetail/ConnectionsTab";

export default function ConnectionsPage() {
  const { client, canEdit } = useOutletContext();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
          MCP credentials for this client's tools. Secrets are encrypted at rest and never shown in full.
        </p>
      </header>
      <ConnectionsTab client={client} canEdit={canEdit} />
    </div>
  );
}
