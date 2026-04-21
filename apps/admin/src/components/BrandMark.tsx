import Link from "next/link";

/**
 * Logo + ZERVO wordmark + superscript "ADMIN". Used in the auth topbar
 * and at the top of the signed-in sidebar.
 */
export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const logoSize = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const adminSize = size === "sm" ? "text-[8px]" : "text-[9px]";

  return (
    <Link href="/" className="inline-flex items-center gap-2.5">
      <span
        aria-hidden
        className={`block ${logoSize} bg-[var(--color-fg)]`}
        style={{
          WebkitMaskImage: "url(/logo.svg)",
          maskImage: "url(/logo.svg)",
          WebkitMaskSize: "contain",
          maskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
        }}
      />
      <span className="relative flex items-baseline">
        <span
          className={`font-semibold uppercase tracking-[0.18em] text-[var(--color-fg)] ${textSize}`}
        >
          ZERVO
        </span>
        <sup
          className={`ml-1 font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)] ${adminSize}`}
        >
          ADMIN
        </sup>
      </span>
    </Link>
  );
}

export default BrandMark;
