import { LuLayoutDashboard, LuWallet, LuArrowRightLeft, LuPiggyBank, LuChartLine, LuFlaskConical } from "react-icons/lu";
import { IconType } from "react-icons";

export type NavItem = {
  href: string;
  label: string;
  icon?: IconType;
  badge?: string;
  disabled?: boolean;
  /** Feature flag key from features.yaml — item is hidden if flag is disabled */
  featureFlag?: string;
  /** Tier feature key from tiers.yaml — item requires this feature to be accessible */
  tierFeature?: string;
};

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
      { href: "/transactions", label: "Transactions", icon: LuArrowRightLeft },
      { href: "/budgets", label: "Budgets", icon: LuPiggyBank, tierFeature: "budgets" },
    ],
  },
  {
    title: "Investing",
    items: [
      { href: "/investments", label: "Portfolio", icon: LuChartLine, tierFeature: "investments" },
      {
        href: "/paper-trading",
        label: "Paper Trading",
        icon: LuFlaskConical,
        featureFlag: "paper_trading",
        tierFeature: "paper_trading",
      },
    ],
  },
];
