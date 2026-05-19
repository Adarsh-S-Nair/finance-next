import DeveloperPageHeader from "@/components/DeveloperPageHeader";
import EndpointPlayground from "@/components/EndpointPlayground";
import { getEndpoint } from "@/lib/api-registry";

export const dynamic = "force-static";

export default function OverviewPage() {
  const hello = getEndpoint("hello");
  if (!hello) {
    throw new Error("missing endpoint: hello");
  }

  return (
    <>
      <DeveloperPageHeader title="API Reference" />
      <EndpointPlayground endpoint={hello} />
    </>
  );
}
