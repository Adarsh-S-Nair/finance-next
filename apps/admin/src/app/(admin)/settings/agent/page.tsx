import AdminPageHeader from "@/components/AdminPageHeader";
import { AgentConfigClient } from "./AgentConfigClient";

export const dynamic = "force-dynamic";

export default function AgentSettingsPage() {
  return (
    <>
      <AdminPageHeader
        title="Agent"
        subtitle="API keys + Claude model used by the personal finance agent."
      />
      <AgentConfigClient />
    </>
  );
}
