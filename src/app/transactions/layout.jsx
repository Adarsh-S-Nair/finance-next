import AppShell from "../../components/AppShell";

export const metadata = {
  title: 'Transactions',
};

export default function TransactionsLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}
