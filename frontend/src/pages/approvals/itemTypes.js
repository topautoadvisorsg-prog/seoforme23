// Shared display metadata for approval item types + statuses.

export const ITEM_TYPE_META = {
  social_batch: { label: "Social Batch", color: "bg-violet-100 text-violet-800" },
  social_post: { label: "Social Post", color: "bg-violet-100 text-violet-800" },
  blog_post: { label: "Blog", color: "bg-blue-100 text-blue-800" },
  gbp_post: { label: "GBP Post", color: "bg-emerald-100 text-emerald-800" },
  gbp_review: { label: "GBP Review", color: "bg-emerald-100 text-emerald-800" },
  gbp_qa: { label: "GBP Q&A", color: "bg-emerald-100 text-emerald-800" },
  ads_recommendation: { label: "Ads Rec", color: "bg-amber-100 text-amber-800" },
  video_script: { label: "Video Script", color: "bg-rose-100 text-rose-800" },
  video_final: { label: "Video Final", color: "bg-rose-100 text-rose-800" },
  review_response: { label: "Review Reply", color: "bg-emerald-100 text-emerald-800" },
  backlink_outreach: { label: "Backlink", color: "bg-cyan-100 text-cyan-800" },
  lsa_dispute: { label: "LSA Dispute", color: "bg-orange-100 text-orange-800" },
};

export const STATUS_META = {
  pending: { label: "Pending", color: "bg-blue-100 text-blue-800" },
  approved: { label: "Approved", color: "bg-green-100 text-green-800" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700" },
  stale: { label: "Stale", color: "bg-amber-100 text-amber-800" },
  edited: { label: "Edited", color: "bg-indigo-100 text-indigo-800" },
};

export const typeMeta = (t) =>
  ITEM_TYPE_META[t] || { label: t, color: "bg-gray-100 text-gray-700" };

export const statusMeta = (s) =>
  STATUS_META[s] || { label: s, color: "bg-gray-100 text-gray-700" };
