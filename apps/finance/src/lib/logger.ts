import { Logger as AxiomLogger } from 'next-axiom';

/**
 * Generate a short unique request ID
 */
function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().split('-')[0]; // First segment: 8 chars
  }
  return Math.random().toString(36).substring(2, 10);
}

interface LogData {
  level: string;
  message: string;
  context: string;
  requestId: string;
  timestamp: string;
  [key: string]: unknown;
}

interface OperationRecord {
  name: string;
  startTime: number;
}

/**
 * Logger utility for Axiom
 * Provides structured logging with correlation IDs and operation tracking
 */
class Logger {
  readonly context: string;
  readonly requestId: string;
  private axiomLogger: AxiomLogger;
  private operations: Map<string, OperationRecord>;

  constructor(context: string = '', requestId: string | null = null) {
    this.context = context;
    this.requestId = requestId || generateRequestId();
    this.axiomLogger = new AxiomLogger();
    this.operations = new Map();
  }

  /**
   * Create a child logger with the same request ID but different context
   */
  child(childContext: string): Logger {
    return new Logger(`${this.context}:${childContext}`, this.requestId);
  }

  /**
   * Start timing an operation
   */
  startOperation(operationName: string): string {
    const opId = `${operationName}-${Date.now()}`;
    this.operations.set(opId, {
      name: operationName,
      startTime: performance.now(),
    });
    this.debug(`Starting operation: ${operationName}`, { operation: operationName });
    return opId;
  }

  /**
   * End timing an operation and log the duration
   */
  endOperation(opId: string, metadata: Record<string, unknown> = {}): number | void {
    const op = this.operations.get(opId);
    if (!op) {
      this.warn(`Unknown operation ID: ${opId}`);
      return;
    }
    const duration = Math.round(performance.now() - op.startTime);
    this.operations.delete(opId);
    this.info(`Completed operation: ${op.name}`, {
      operation: op.name,
      durationMs: duration,
      ...metadata,
    });
    return duration;
  }

  info(message: string, metadata: Record<string, unknown> = {}): LogData {
    return this._log('info', message, metadata);
  }

  warn(message: string, metadata: Record<string, unknown> = {}): LogData {
    return this._log('warn', message, metadata);
  }

  /**
   * `error` is permissive: pass an Error to attach stack/name metadata, or
   * `null`/`undefined` when you just want to log a message with context.
   */
  error(
    message: string,
    error: Error | { message?: string; stack?: string; name?: string } | null | undefined = null,
    metadata: Record<string, unknown> = {}
  ): LogData {
    const errorData = error
      ? {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
            type: categorizeError(error),
          },
        }
      : {};

    return this._log('error', message, { ...metadata, ...errorData });
  }

  debug(message: string, metadata: Record<string, unknown> = {}): LogData {
    return this._log('debug', message, metadata);
  }

  private _log(
    level: string,
    message: string,
    metadata: Record<string, unknown> = {}
  ): LogData {
    const logData: LogData = {
      level,
      message,
      context: this.context,
      requestId: this.requestId,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `[${level.toUpperCase()}] [${this.requestId}] [${this.context}] ${message}`,
        Object.keys(metadata).length > 0 ? metadata : ''
      );
    }

    try {
      // next-axiom typings restrict the first arg to a LogLevel literal;
      // we accept arbitrary `level` strings here for back-compat with
      // existing callers and let the runtime validate.
      this.axiomLogger.log(level as unknown as Parameters<AxiomLogger['log']>[0], message, {
        context: this.context,
        requestId: this.requestId,
        ...metadata,
      });
    } catch (error) {
      const e = error as { message?: string };
      if (
        !e?.message?.includes('terminal') &&
        !e?.message?.includes('Cannot read properties of undefined')
      ) {
        console.error('Error logging to Axiom:', error);
      }
    }

    return logData;
  }

  async flush(): Promise<void> {
    try {
      await this.axiomLogger.flush();
    } catch (error) {
      const e = error as { message?: string };
      if (
        e?.message?.includes('terminal') ||
        e?.message?.includes('Cannot read properties of undefined')
      ) {
        return;
      }
      console.error('Failed to flush logs to Axiom:', error);
    }
  }
}

export type { Logger };

/**
 * Categorize error types for easier filtering
 */
function categorizeError(
  error: { message?: string; name?: string } | null | undefined
): string {
  const message = error?.message?.toLowerCase() || '';
  const name = error?.name || '';

  if (name === 'PlaidError' || message.includes('plaid')) return 'plaid';
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('econnrefused')
  )
    return 'network';
  if (message.includes('timeout') || message.includes('timed out')) return 'timeout';
  if (message.includes('rate limit') || message.includes('429')) return 'rate_limit';
  if (
    message.includes('unauthorized') ||
    message.includes('401') ||
    message.includes('403')
  )
    return 'auth';
  if (message.includes('not found') || message.includes('404')) return 'not_found';
  if (message.includes('validation') || message.includes('invalid')) return 'validation';
  if (
    message.includes('database') ||
    message.includes('supabase') ||
    message.includes('postgres')
  )
    return 'database';
  return 'unknown';
}

/**
 * Create a logger instance for a specific context
 */
export function createLogger(context: string, requestId: string | null = null): Logger {
  return new Logger(context, requestId);
}

/**
 * Wrap an API route handler with automatic logging
 * Logs request start, completion, and errors with timing
 */
export function withLogging<
  T extends (request: Request, routeContext: { logger: Logger } & Record<string, unknown>) => Promise<Response>
>(routeName: string, handler: T) {
  return async (
    request: Request,
    routeContext: Record<string, unknown> = {}
  ): Promise<Response> => {
    const logger = createLogger(routeName);
    const startTime = performance.now();

    const method = request.method;
    const url = request.url;
    const userAgent = request.headers?.get?.('user-agent') || 'unknown';

    logger.info('Request started', {
      method,
      url,
      userAgent: userAgent.substring(0, 100),
    });

    try {
      const response = await handler(request, { ...routeContext, logger });

      const duration = Math.round(performance.now() - startTime);
      const status = response?.status || 200;

      logger.info('Request completed', {
        method,
        status,
        durationMs: duration,
      });

      await logger.flush();
      return response;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);

      logger.error('Request failed', error as Error, {
        method,
        url,
        durationMs: duration,
      });

      await logger.flush();

      throw error;
    }
  };
}

/**
 * Default logger instance
 */
export const logger = new Logger('app');

export default logger;
