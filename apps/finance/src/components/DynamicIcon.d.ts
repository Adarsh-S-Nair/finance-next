import type { CSSProperties } from "react";
import type { IconType } from "react-icons";

export interface DynamicIconProps {
  /** react-icons library prefix, e.g. "Fi", "Tb". Null/undefined → fallback. */
  iconLib?: string | null;
  /** Icon export name within the library, e.g. "FiHome". Null → fallback. */
  iconName?: string | null;
  className?: string;
  /** Rendered when the library/name is missing or fails to resolve. */
  fallback?: IconType;
  style?: CSSProperties;
}

declare function DynamicIcon(props: DynamicIconProps): JSX.Element;

export default DynamicIcon;
