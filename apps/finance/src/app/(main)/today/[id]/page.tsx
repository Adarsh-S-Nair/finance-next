import FindingDetail from "../../../../components/today/FindingDetail";

export default async function FindingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FindingDetail id={id} />;
}
