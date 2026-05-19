import { notFound } from "next/navigation";
import EndpointDocs from "../../../../components/api-docs/EndpointDocs";
import { ENDPOINTS, getEndpoint } from "@zervo/api-spec";

export function generateStaticParams() {
  return ENDPOINTS.map((e) => ({ id: e.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const endpoint = getEndpoint(id);
  return {
    title: endpoint ? `${endpoint.summary} — API` : "API",
  };
}

export default async function EndpointDocPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const endpoint = getEndpoint(id);
  if (!endpoint) notFound();

  return <EndpointDocs endpoint={endpoint} />;
}
