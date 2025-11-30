import AppShell from "../../components/AppShell";

export const metadata = {
  title: 'Accounts',
};

export default function AccountsLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}
