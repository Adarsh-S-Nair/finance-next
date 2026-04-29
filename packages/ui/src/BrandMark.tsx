import Link from "next/link";
import clsx from "clsx";

type Size = "sm" | "md" | "lg";

const SIZE_MAP: Record<Size, { logo: string; text: string; suffix: string }> = {
  sm: { logo: "h-6 w-6", text: "text-xs", suffix: "text-[8px]" },
  md: { logo: "h-8 w-8", text: "text-sm", suffix: "text-[9px]" },
  lg: { logo: "h-10 w-10", text: "text-sm", suffix: "text-[9px]" },
};

export type BrandMarkProps = {
  size?: Size;
  /** Superscript label after ZERVO (e.g. "ADMIN"). Hidden when absent. */
  suffix?: string;
  /** Link destination. Pass `null` to render a non-link span. */
  href?: string | null;
  className?: string;
};

export default function BrandMark({
  size = "md",
  suffix,
  href = "/",
  className,
}: BrandMarkProps) {
  const s = SIZE_MAP[size];

  const inner = (
    <>
      <span
        aria-hidden
        className={clsx("block bg-[var(--color-fg)]", s.logo)}
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
          className={clsx(
            "font-semibold uppercase tracking-[0.18em] text-[var(--color-fg)]",
            s.text,
          )}
        >
          ZERVO
        </span>
        {suffix ? (
          <sup
            className={clsx(
              "ml-1 font-semibold uppercase tracking-[0.1em] text-[var(--color-accent)]",
              s.suffix,
            )}
          >
            {suffix}
          </sup>
        ) : null}
      </span>
    </>
  );

  const wrapperClass = clsx("inline-flex items-center gap-3", className);

  if (href === null) {
    return <span className={wrapperClass}>{inner}</span>;
  }

  return (
    <Link href={href} className={wrapperClass}>
      {inner}
    </Link>
  );
}
