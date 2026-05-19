import DeveloperPageHeader from "@/components/DeveloperPageHeader";

export const dynamic = "force-static";

export default function OverviewPage() {
  return (
    <>
      <DeveloperPageHeader title="Overview" />

      <p className="text-sm text-[var(--color-muted)] max-w-prose">
        Welcome. Public developer APIs by Zervo, starting with US politician
        trade disclosures.
      </p>
    </>
  );
}
