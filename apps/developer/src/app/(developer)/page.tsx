import DeveloperPageHeader from "@/components/DeveloperPageHeader";
import EndpointPlayground from "@/components/EndpointPlayground";
import { ENDPOINTS } from "@/lib/api-registry";

export const dynamic = "force-static";

export default function OverviewPage() {
  return (
    <>
      <DeveloperPageHeader title="API Reference" />
      <div className="divide-y divide-[var(--color-fg)]/[0.08] space-y-16 [&>*:not(:first-child)]:pt-16">
        {ENDPOINTS.map((e) => (
          <EndpointPlayground key={e.id} endpoint={e} />
        ))}
      </div>
    </>
  );
}
