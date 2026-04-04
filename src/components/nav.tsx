import { HiMiniSquares2X2, HiMiniWallet, HiMiniArrowsRightLeft, HiMiniBanknotes, HiMiniChartBar, HiMiniBeaker } from "react-icons/hi2";
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
      { href: "/dashboard", label: "Dashboard", icon: HiMiniSquares2X2 },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/accounts", label: "Accounts", icon: HiMiniWallet },
      { href: "/transactions", label: "Transactions", icon: HiMiniArrowsRightLeft },
      { href: "/budgets", label: "Budgets", icon: HiMiniBanknotes, tierFeature: "budgets" },
    ],
  },
  {
    title: "Investing",
    items: [
      { href: "/investments", label: "Portfolio", icon: HiMiniChartBar, tierFeature: "investments" },
      {
        href: "/paper-trading",
        label: "Paper Trading",
        icon: HiMiniBeaker,
        featureFlag: "paper_trading",
        tierFeature: "paper_trading",
      },
    ],
  },
];
