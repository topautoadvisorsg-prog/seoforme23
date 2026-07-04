import { useState } from "react";
import { X, Check, Ban, Flag, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { approvalsService } from "@/services/approvalsService";
import { formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { typeMeta, statusMeta } from "./itemTypes";

/* ---------- per-type payload renderers ---------- */
function Labeled({ label, children }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
        {label}
      </p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function PayloadBody({ item }) {
  const p = item.payload || {};
  switch (item.item_type) {
    case "social_batch":
      return (
        <div className="space-y-3">
          {(p.posts || []).map((post, i) => (
            <div key={i} className="rounded-md border border-[rgb(var(--color-border))] p-3">
              <span className="mb-1 inline-block rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium capitalize text-violet-800">
                {post.platform}
              </span>
              <p className="text-sm">{post.caption}</p>
            </div>
          ))}
        </div>
      );
    case "social_post":
      return (
        <Labeled label={p.platform || "Post"}>
          <p>{p.caption}</p>
        </Labeled>
      );
    case "blog_post":
      return (
        <div className="space-y-3">
          <Labeled label="Title">{p.title}</Labeled>
          {p.meta_description && <Labeled label="Meta">{p.meta_description}</Labeled>}
          {p.body && (
            <Labeled label="Body">
              <p className="whitespace-pre-wrap text-sm">{p.body}</p>
            </Labeled>
          )}
        </div>
      );
    case "ads_recommendation":
      return (
        <div className="space-y-3">
          <Labeled label="Recommendation">{p.recommendation}</Labeled>
          {p.rationale && <Labeled label="Rationale">{p.rationale}</Labeled>}
          {p.estimated_impact && <Labeled label="Estimated Impact">{p.estimated_impact}</Labeled>}
        </div>
      );
    case "video_script":
    case "video_final":
      return (
        <div className="space-y-3">
          {p.video_url && (
            <Labeled label="Rendered Video">
              <a href={p.video_url} target="_blank" rel="noopener noreferrer" className="text-[rgb(var(--color-primary))] hover:underline">
                {p.video_url}
              </a>
              {p.rendered_by && (
                <span className="ml-2 text-xs text-[rgb(var(--color-text-muted))]">· {p.rendered_by}</span>
              )}
            </Labeled>
          )}
          {p.duration && <Labeled label="Duration">{p.duration}</Labeled>}
          {p.script && (
            <Labeled label="Script">
              <pre className="whitespace-pre-wrap font-sans text-sm">{p.script}</pre>
            </Labeled>
          )}
        </div>
      );
    case "gbp_review":
    case "review_response":
      return (
        <div className="space-y-3">
          {p.review_rating != null && <Labeled label="Rating">{"★".repeat(p.review_rating)}{"☆".repeat(5 - p.review_rating)}</Labeled>}
          {p.review_text && <Labeled label="Review">{p.review_text}</Labeled>}
          {p.draft_reply && (
            <Labeled label="Draft Reply">
              <p className="rounded-md bg-blue-50 p-3 text-sm">{p.draft_reply}</p>
            </Labeled>
          )}
        </div>
      );
    default:
      return (
        <pre className="overflow-auto rounded-md bg-gray-50 p-3 text-xs">
          {JSON.stringify(p, null, 2)}
        </pre>
      );
  }
}

/* ---------- modal ---------- */
export default function ReviewModal({ item, onClose, onChanged }) {
  const { operator } = useAuth();
  const canManage = ["admin", "manager"].includes(operator?.role);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => JSON.stringify(item.payload || {}, null, 2));

  const tm = typeMeta(item.item_type);
  const sm = statusMeta(item.status);
  const actionable = item.status === "pending";

  const run = async (fn, successMsg) => {
    setBusy(true);
    try {
      const updated = await fn();
      if (successMsg) toast.success(successMsg);
      onChanged(updated);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const doApprove = () =>
    run(() => approvalsService.approve(item.id, notes ? { review_notes: notes } : {}), "Approved");
  const doReject = () => {
    if (!notes.trim()) return toast.error("A reason is required to reject.");
    run(() => approvalsService.reject(item.id, notes.trim()), "Rejected");
  };
  const doFlag = () =>
    run(() => approvalsService.flag(item.id), item.flagged ? "Unflagged" : "Flagged");
  const doRequeue = () => run(() => approvalsService.requeue(item.id), "Re-queued");
  const doDelete = () =>
    run(async () => {
      await approvalsService.remove(item.id);
      return null;
    }, "Deleted");
  const doSaveEdit = () => {
    let parsed;
    try {
      parsed = JSON.parse(draft);
    } catch {
      return toast.error("Payload is not valid JSON.");
    }
    run(() => approvalsService.update(item.id, parsed), "Edits saved").then(() => setEditing(false));
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div
        data-testid="review-modal"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-[rgb(var(--color-border))] bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-[rgb(var(--color-border))] px-6 py-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tm.color}`}>{tm.label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${sm.color}`}>{sm.label}</span>
              {item.flagged && <Flag size={13} className="text-[rgb(var(--color-warning))]" />}
            </div>
            <h2 className="text-base font-semibold">{item.title}</h2>
            <p className="text-xs text-[rgb(var(--color-text-muted))]">{item.client_name}</p>
          </div>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100" aria-label="Close" data-testid="review-close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-auto p-6">
          {item.payload?._client_paused && (
            <div className="rounded-md border border-[rgb(var(--color-warning))] bg-amber-50 px-3 py-2 text-sm text-[rgb(var(--color-warning))]">
              ⚠ Client is paused — approving records the decision but will not auto-execute. Run it manually.
            </div>
          )}
          {item.status === "approved" && (
            <div className="rounded-md border border-[rgb(var(--color-border))] bg-gray-50 px-3 py-2 text-sm">
              {item.execution_status === "success" ? (
                <span className="font-medium text-[rgb(var(--color-success))]">
                  ✓ Executed{item.execution_target ? ` via ${item.execution_target}` : ""}
                </span>
              ) : item.execution_status === "failed" ? (
                <span className="text-[rgb(var(--color-danger))]">Execution failed: {item.execution_error}</span>
              ) : item.execution_status === "in_progress" ? (
                <span>Executing…</span>
              ) : item.execution_status === "awaiting_render" ? (
                <span className="text-[rgb(var(--color-warning))]">✓ Approved — sent to the agent to render</span>
              ) : item.execution_status === "rendered" ? (
                <span className="text-[rgb(var(--color-success))]">✓ Rendered — finished video is in the queue</span>
              ) : (
                <span className="text-[rgb(var(--color-text-muted))]">Approved — awaiting manual execution</span>
              )}
            </div>
          )}
          {editing ? (
            <textarea
              data-testid="review-edit-textarea"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="focus-ring h-72 w-full rounded-md border border-[rgb(var(--color-border))] p-3 font-mono text-xs"
            />
          ) : (
            <PayloadBody item={item} />
          )}

          {item.review_notes && (
            <Labeled label="Review Notes">
              <p className="text-sm text-[rgb(var(--color-text-muted))]">{item.review_notes}</p>
            </Labeled>
          )}

          {actionable && (
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
                Notes (required to reject)
              </p>
              <textarea
                data-testid="review-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional note for approval, or reason for rejection…"
                className="focus-ring w-full rounded-md border border-[rgb(var(--color-border))] p-2 text-sm"
              />
            </div>
          )}
        </div>

        {/* actions */}
        <div className="space-y-2 border-t border-[rgb(var(--color-border))] p-4">
          {actionable && !editing && (
            <div className="flex gap-2">
              <button
                data-testid="review-approve"
                disabled={busy}
                onClick={doApprove}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[rgb(var(--color-success))] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                <Check size={16} /> Approve
              </button>
              <button
                data-testid="review-reject"
                disabled={busy}
                onClick={doReject}
                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-[rgb(var(--color-danger))] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                <Ban size={16} /> Reject
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {actionable && (
              <>
                <button
                  data-testid="review-flag"
                  disabled={busy}
                  onClick={doFlag}
                  className="flex items-center gap-1.5 rounded-md border border-[rgb(var(--color-border))] px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <Flag size={14} /> {item.flagged ? "Unflag" : "Flag"}
                </button>
                {editing ? (
                  <>
                    <button data-testid="review-save-edit" disabled={busy} onClick={doSaveEdit} className="rounded-md border border-[rgb(var(--color-primary))] px-3 py-2 text-sm text-[rgb(var(--color-primary))] hover:bg-blue-50">
                      Save edits
                    </button>
                    <button onClick={() => setEditing(false)} className="rounded-md border border-[rgb(var(--color-border))] px-3 py-2 text-sm hover:bg-gray-50">
                      Cancel edit
                    </button>
                  </>
                ) : (
                  <button data-testid="review-edit" onClick={() => setEditing(true)} className="rounded-md border border-[rgb(var(--color-border))] px-3 py-2 text-sm hover:bg-gray-50">
                    Edit payload
                  </button>
                )}
              </>
            )}
            {canManage && ["stale", "rejected"].includes(item.status) && (
              <button data-testid="review-requeue" disabled={busy} onClick={doRequeue} className="flex items-center gap-1.5 rounded-md border border-[rgb(var(--color-border))] px-3 py-2 text-sm hover:bg-gray-50">
                <RotateCcw size={14} /> Re-queue
              </button>
            )}
            {canManage && (
              <button data-testid="review-delete" disabled={busy} onClick={doDelete} className="ml-auto flex items-center gap-1.5 rounded-md border border-[rgb(var(--color-border))] px-3 py-2 text-sm text-[rgb(var(--color-danger))] hover:bg-red-50">
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
