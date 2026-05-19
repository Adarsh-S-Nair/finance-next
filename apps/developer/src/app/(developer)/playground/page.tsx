import DeveloperPageHeader from "@/components/DeveloperPageHeader";
import EndpointList from "@/components/EndpointList";
import { ENDPOINTS } from "@/lib/api-registry";

export const dynamic = "force-static";

export default function PlaygroundIndexPage() {
  return (
    <>
      <DeveloperPageHeader
        title="Playground"
        subtitle="Click an endpoint to make a live request."
      />
      <EndpointList
        endpoints={ENDPOINTS}
        hrefFor={(e) => `/playground/${e.id}`}
      />
    </>
  );
}
