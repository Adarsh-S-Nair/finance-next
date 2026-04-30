/**
 * Constants and helpers for the impersonation cookie. The cookie is
 * httpOnly so client JS can't read or forge it — banner state comes
 * from /api/impersonation/me, which validates the cookie server-side
 * against impersonation_sessions before returning context.
 */

export const IMPERSONATION_COOKIE_NAME = "zervo_impersonator_session";

export const IMPERSONATION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
