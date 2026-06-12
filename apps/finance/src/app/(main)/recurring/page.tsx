import { redirect } from "next/navigation";

// Bills & Subscriptions moved into the transactions surface (owner
// verdict 2026-06-12). Keep this route as a permanent deep link.
export default function RecurringPage() {
  redirect("/transactions?view=bills");
}
