/**
 * Timezone helpers for the agent runtime.
 *
 * The chat route runs on Vercel in UTC. Without an explicit timezone
 * the model gets UTC's idea of "today", which can be a day off for any
 * user not in UTC — most visibly around midnight or on the first/last
 * of the month. The browser sends its IANA timezone with each chat
 * POST and we resolve "today" against it here.
 */
import { formatInTimeZone } from 'date-fns-tz';

const FALLBACK_TZ = 'UTC';

/**
 * Validate that a string is an IANA timezone the runtime recognises.
 * Accepts undefined / empty as a "use fallback" signal. Rejects anything
 * Intl.DateTimeFormat throws on. Returning the validated string (or
 * fallback) means callers don't need their own try/catch.
 */
export function resolveTimeZone(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return FALLBACK_TZ;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: input });
    return input;
  } catch {
    return FALLBACK_TZ;
  }
}

/** Today as YYYY-MM-DD in the given timezone. */
export function todayYmdInTz(tz: string): string {
  return formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
}
