import { BrandMark as BaseBrandMark, type BrandMarkProps } from "@zervo/ui";

/**
 * Admin BrandMark — the shared @zervo/ui mark with the "ADMIN" superscript
 * pre-filled. Used in the auth topbar and at the top of the signed-in
 * sidebar.
 */
export function BrandMark(props: Omit<BrandMarkProps, "suffix">) {
  return <BaseBrandMark suffix="ADMIN" {...props} />;
}

export default BrandMark;
