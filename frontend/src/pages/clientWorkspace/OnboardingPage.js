import { useOutletContext } from "react-router-dom";
import OnboardingTab from "@/pages/clientDetail/OnboardingTab";

export default function OnboardingPage() {
  const { client, reload } = useOutletContext();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
        <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
          Setup checklist for {client.name}. Agents can run once every item is complete.
        </p>
      </header>
      <OnboardingTab clientId={client.id} onClientChange={reload} />
    </div>
  );
}
