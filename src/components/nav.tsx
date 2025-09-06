import { LuLayoutDashboard, LuWallet, LuReceipt, LuPiggyBank, LuChartLine, LuSettings } from "react-icons/lu";
import { IconType } from "react-icons";

export type NavItem = { href: string; label: string; icon?: IconType; badge?: string; disabled?: boolean };

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LuLayoutDashboard },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/accounts", label: "Accounts", icon: LuWallet },
      { href: "/transactions", label: "Transactions", icon: LuReceipt, disabled: true },
      { href: "/budgets", label: "Budgets", icon: LuPiggyBank, disabled: true },
    ],
  },
  {
    title: "Investing",
    items: [
      { href: "/investments", label: "Investments", icon: LuChartLine, disabled: true },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/settings", label: "Settings", icon: LuSettings },
    ],
  },
];


