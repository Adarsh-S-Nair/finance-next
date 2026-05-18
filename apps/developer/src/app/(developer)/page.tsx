import DeveloperPageHeader from "@/components/DeveloperPageHeader";

export const dynamic = "force-static";

export default function OverviewPage() {
  return (
    <>
      <DeveloperPageHeader
        title="Overview"
        subtitle="Developer APIs by Zervo. Build on top of public financial data."
      />

      <section className="space-y-10">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]/60 mb-4">
            Coming soon
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComingSoonCard
              title="Politician trade feed"
              description="Stream STOCK Act disclosures from US Congress members. Filter by ticker, chamber, party, or person. Public data, structured and indexed."
            />
            <ComingSoonCard
              title="API keys"
              description="Issue and rotate keys per project. Per-key rate limits and usage analytics."
            />
            <ComingSoonCard
              title="Webhooks"
              description="Subscribe to new disclosures as they hit the feed. Signed payloads, retry-with-backoff."
            />
            <ComingSoonCard
              title="Historical exports"
              description="Bulk CSV / Parquet downloads of the full disclosure history for offline analysis."
            />
          </div>
        </div>
      </section>
    </>
  );
}

function ComingSoonCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-fg)]/[0.08] p-5">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="text-sm font-medium text-[var(--color-fg)]">{title}</h3>
        <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-accent)] font-semibold flex-shrink-0">
          Soon
        </span>
      </div>
      <p className="text-xs text-[var(--color-muted)] leading-relaxed">
        {description}
      </p>
    </div>
  );
}
