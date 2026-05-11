import PageContainer from "../../../components/layout/PageContainer";
import SettingsNav from "../../../components/settings/SettingsNav";

export const metadata = {
  title: "Settings",
};

export default function SettingsLayout({ children }) {
  return (
    <PageContainer title="Settings">
      <div className="grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-x-10 gap-y-2 mt-2">
        <SettingsNav />
        <div className="max-w-2xl min-w-0">{children}</div>
      </div>
    </PageContainer>
  );
}
