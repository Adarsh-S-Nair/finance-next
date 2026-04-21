import { redirect } from "next/navigation";

// /households/<id> has no standalone landing content — the sidebar only
// exposes Accounts and Investments in household scope, so land on Accounts.
export default async function HouseholdIndexPage({ params }) {
  const { id } = await params;
  redirect(`/households/${id}/accounts`);
}
