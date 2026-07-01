import { useOutletContext } from "react-router-dom";
import ServicesTab from "@/pages/clientDetail/ServicesTab";

export default function ServicesPage() {
  const { client, reload, canEdit } = useOutletContext();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
        <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
          Toggle the modules this client is subscribed to. Enabling a service generates its onboarding checklist.
        </p>
      </header>
      <ServicesTab client={client} onClientChange={reload} canEdit={canEdit} />
    </div>
  );
}
