import { notFound } from "next/navigation";
import EndpointPlayground from "@/components/EndpointPlayground";
import { ENDPOINTS, getEndpoint } from "@zervo/api-spec";

export const dynamic = "force-static";

export function generateStaticParams() {
  return ENDPOINTS.map((e) => ({ id: e.id }));
}

export default async function EndpointPlaygroundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const endpoint = getEndpoint(id);
  if (!endpoint) notFound();

  return <EndpointPlayground endpoint={endpoint} />;
}
