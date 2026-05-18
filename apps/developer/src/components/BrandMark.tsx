import { BrandMark as BaseBrandMark, type BrandMarkProps } from "@zervo/ui";

/**
 * Developer BrandMark — shared @zervo/ui mark with the "DEV" superscript
 * pre-filled. Used on the auth page; the floating sidebar omits any
 * brand mark to mirror finance.
 */
export function BrandMark(props: Omit<BrandMarkProps, "suffix">) {
  return <BaseBrandMark suffix="DEV" {...props} />;
}

export default BrandMark;
