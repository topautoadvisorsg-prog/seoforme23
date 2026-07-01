import { useState } from "react";
import { Copy, X, Check } from "lucide-react";
import { toast } from "sonner";

export default function WorkspaceIdModal({ workspaceId, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(workspaceId);
      setCopied(true);
      toast.success("Workspace ID copied");
      setTimeout(() => setCopied(false), 2000);
    } catch (_e) {
      toast.error("Could not copy. Select and copy manually.");
    }
  };

  return (
    <div
      data-testid="workspace-id-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-[rgb(var(--color-border))] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[rgb(var(--color-border))] px-6 py-4">
          <h2 className="text-base font-semibold">Workspace ID</h2>
          <button
            onClick={onClose}
            className="rounded p-1 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 p-6">
          <div
            data-testid="workspace-id-value"
            className="mono break-all rounded-md border border-[rgb(var(--color-border))] bg-gray-50 p-3 text-sm"
          >
            {workspaceId}
          </div>
          <button
            onClick={copy}
            data-testid="workspace-id-copy-btn"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-[rgb(var(--color-primary))] py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy to Clipboard"}
          </button>
          <p className="text-xs leading-relaxed text-[rgb(var(--color-text-muted))]">
            Use this ID in your Cowork Scheduled Tasks so the dashboard
            knows which client each agent output belongs to. Include it in
            the webhook payload:
          </p>
          <pre className="mono whitespace-pre-wrap rounded-md bg-gray-900 p-3 text-[11px] text-gray-100">{`{
  "workspace_id": "${workspaceId}",
  "item_type": "social_batch",
  ...
}`}</pre>
        </div>
      </div>
    </div>
  );
}
