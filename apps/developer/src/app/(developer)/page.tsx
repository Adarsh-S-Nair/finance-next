import { redirect } from "next/navigation";

/**
 * Root of the developer portal — sends visitors straight to /docs, which
 * is the most common entry point. Playground lives at /playground for
 * users who want to skip the reading.
 */
export default function RootPage() {
  redirect("/docs");
}
