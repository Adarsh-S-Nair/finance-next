import { ReactNode } from "react";
import DeveloperShell from "@/components/DeveloperShell";

/**
 * Group layout for all signed-in developer routes. Rendering the shell
 * here keeps the sidebar + topbar mounted across navigation — only the
 * page body re-fetches.
 */
export default function DeveloperGroupLayout({ children }: { children: ReactNode }) {
  return <DeveloperShell>{children}</DeveloperShell>;
}
