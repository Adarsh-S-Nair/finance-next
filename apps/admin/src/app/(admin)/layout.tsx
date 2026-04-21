import { ReactNode } from "react";
import AdminShell from "@/components/AdminShell";

/**
 * Group layout for all signed-in admin pages. Rendering the shell here
 * (instead of inside each page) means the sidebar/profile bar are reused
 * across navigation — only the page body re-fetches, so tab switches
 * feel instant instead of re-running the whole layout pipeline each time.
 */
export default function AdminGroupLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
