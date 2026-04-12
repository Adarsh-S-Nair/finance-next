/**
 * Ambient type declarations for the (JS) logger module.
 *
 * Keep in sync with `src/lib/logger.js`. Only declares the public surface
 * consumed by TypeScript call sites — not every internal helper.
 */

export interface Logger {
  readonly context: string;
  readonly requestId: string;

  child(childContext: string): Logger;

  startOperation(operationName: string): string;
  endOperation(opId: string, metadata?: Record<string, unknown>): number | void;

  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  debug(message: string, metadata?: Record<string, unknown>): void;

  /**
   * `error` is permissive: pass an Error to attach stack/name metadata, or
   * `null`/`undefined` when you just want to log a message with context.
   */
  error(
    message: string,
    error?: Error | null,
    metadata?: Record<string, unknown>
  ): void;

  flush(): Promise<void>;
}

export function createLogger(context: string, requestId?: string | null): Logger;

/**
 * HOF that wraps a Next.js route handler to attach a scoped logger and
 * automatically log request start/end/errors. See logger.js for details.
 */
export function withLogging<T extends (...args: unknown[]) => unknown>(
  context: string,
  handler: T
): T;
