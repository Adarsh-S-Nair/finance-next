import AppShell from "../../components/AppShell";

export const metadata = {
  title: 'Dashboard',
};

export default function DashboardLayout({ children }) {
  return (
    <AppShell>{children}</AppShell>
  );
}


