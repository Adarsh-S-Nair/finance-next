import { notFound } from "next/navigation";
import EndpointDocs from "@/components/EndpointDocs";
import { ENDPOINTS, getEndpoint } from "@/lib/api-registry";

export const dynamic = "force-static";

export function generateStaticParams() {
  return ENDPOINTS.map((e) => ({ id: e.id }));
}

export default async function EndpointDocsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const endpoint = getEndpoint(id);
  if (!endpoint) notFound();

  return <EndpointDocs endpoint={endpoint} />;
}
