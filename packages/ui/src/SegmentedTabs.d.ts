import { ComponentType } from "react";

export type SegmentedTabOption = {
  label: string;
  value: string;
};

export type SegmentedTabsProps = {
  options: SegmentedTabOption[];
  value: string;
  onChange: (value: string) => void;
  size?: "xs" | "sm" | "md";
  className?: string;
};

declare const SegmentedTabs: ComponentType<SegmentedTabsProps>;
export default SegmentedTabs;
