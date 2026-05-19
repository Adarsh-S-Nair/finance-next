import DeveloperPageHeader from "@/components/DeveloperPageHeader";
import EndpointList from "@/components/EndpointList";
import { ENDPOINTS } from "@/lib/api-registry";

export const dynamic = "force-static";

export default function DocsIndexPage() {
  return (
    <>
      <DeveloperPageHeader
        title="API Reference"
        subtitle="Public developer APIs by Zervo."
      />
      <EndpointList endpoints={ENDPOINTS} hrefFor={(e) => `/docs/${e.id}`} />
    </>
  );
}
