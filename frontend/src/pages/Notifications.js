import { Bell } from "lucide-react";

export default function NotificationsPage() {
  return (
    <div data-testid="notifications-page" className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-[rgb(var(--color-text-muted))]">
          Token health alerts, approval reminders, and agent events.
        </p>
      </header>

      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[rgb(var(--color-border))] bg-white py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-[rgb(var(--color-warning))]">
          <Bell size={26} />
        </div>
        <h2 className="text-base font-semibold">No notifications yet</h2>
        <p className="mt-2 max-w-md text-sm text-[rgb(var(--color-text-muted))]">
          Real-time notifications ship in Phase 7. Urgent alerts will also be emailed via Resend.
        </p>
      </div>
    </div>
  );
}
