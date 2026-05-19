import { redirect } from "next/navigation";

/**
 * Root of the developer portal — sends visitors straight to the
 * playground (the only interactive surface). Reference docs live
 * publicly on zervo.app/docs/api/[id]; the playground links out to
 * them per-endpoint.
 */
export default function RootPage() {
  redirect("/playground");
}
