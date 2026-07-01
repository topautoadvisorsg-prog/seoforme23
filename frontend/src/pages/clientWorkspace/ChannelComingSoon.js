import { useOutletContext, useParams, Link } from "react-router-dom";
import { Search, MapPin, Share2, Megaphone, Phone, Linkedin, Video, SlidersHorizontal } from "lucide-react";

// Honest placeholders: the channel is enabled for the client, but its
// dedicated analytics/management surface lands in a later phase.
const CHANNEL = {
  seo: { label: "SEO", icon: Search, phase: "Phase 6", blurb: "Keyword rankings, on-page audits, and content briefs for this client.", future: ["Rank tracking dashboard", "Site audit findings", "Content brief approvals (already flow into the Content Queue)"] },
  gbp: { label: "Google Business", icon: MapPin, phase: "Phase 6", blurb: "Google Business Profile posts, reviews, and Q&A.", future: ["Review reply queue", "GBP post scheduling", "Profile health checks"] },
  social: { label: "Social", icon: Share2, phase: "Phase 6", blurb: "Social scheduling and performance across platforms.", future: ["Calendar view of scheduled posts", "Engagement metrics", "Batch approvals (already in the Content Queue)"] },
  meta_ads: { label: "Meta Ads", icon: Megaphone, phase: "Phase 6", blurb: "Meta ad campaigns, creatives, and spend.", future: ["Campaign performance", "Creative approvals", "Budget recommendations"] },
  google_ads: { label: "Google Ads", icon: Megaphone, phase: "Phase 6", blurb: "Google ad campaigns, recommendations, and spend.", future: ["Campaign performance", "Recommendation approvals", "Spend pacing"] },
  lsa: { label: "Local Services Ads", icon: Phone, phase: "Phase 6", blurb: "Google LSA leads and dispute management.", future: ["Lead inbox", "Spam dispute drafting", "Lead-to-job tracking"] },
  linkedin_ads: { label: "LinkedIn", icon: Linkedin, phase: "Phase 6", blurb: "LinkedIn ad campaigns and creatives.", future: ["Campaign performance", "Creative approvals"] },
  video: { label: "Video", icon: Video, phase: "Phase 6", blurb: "Video script and finished-render review.", future: ["Script approvals (already in the Content Queue)", "Finished video review", "Publishing"] },
};

export default function ChannelComingSoon() {
  const { channel } = useParams();
  const { client } = useOutletContext();
  const c = CHANNEL[channel] || { label: channel, icon: SlidersHorizontal, phase: "Later", blurb: "", future: [] };
  const Icon = c.icon;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-[rgb(var(--color-primary))]">
          <Icon size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{c.label}</h1>
          <p className="text-sm text-[rgb(var(--color-text-muted))]">Enabled for {client.name}</p>
        </div>
      </header>

      <div className="rounded-xl border border-[rgb(var(--color-border))] bg-white p-8">
        <span className="inline-block rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
          Arriving in {c.phase}
        </span>
        <p className="mt-4 max-w-xl text-sm text-[rgb(var(--color-text))]">{c.blurb}</p>
        {c.future.length > 0 && (
          <>
            <p className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
              What this section will include
            </p>
            <ul className="mt-2 space-y-1.5">
              {c.future.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[rgb(var(--color-text-muted))]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgb(var(--color-primary))]" /> {f}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-6 text-xs text-[rgb(var(--color-text-muted))]">
          In the meantime, all agent-generated content for this channel flows through{" "}
          <Link to="../queue" className="text-[rgb(var(--color-primary))] hover:underline">Content Queue</Link>.
        </p>
      </div>
    </div>
  );
}
