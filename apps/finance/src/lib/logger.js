import { Logger as AxiomLogger } from 'next-axiom';

/**
 * Generate a short unique request ID
 */
function generateRequestId() {
  // Use crypto if available (Node.js 19+), otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().split('-')[0]; // First segment: 8 chars
  }
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Logger utility for Axiom
 * Provides structured logging with correlation IDs and operation tracking
 */
class Logger {
  constructor(context = '', requestId = null) {
    this.context = context;
    this.requestId = requestId || generateRequestId();
    this.axiomLogger = new AxiomLogger();
    this.operations = new Map(); // Track operation timings
  }

  /**
   * Create a child logger with the same request ID but different context
   */
  child(childContext) {
    return new Logger(`${this.context}:${childContext}`, this.requestId);
  }

  /**
   * Start timing an operation
   * @param {string} operationName - Name of the operation
   * @returns {string} - Operation ID to pass to endOperation
   */
  startOperation(operationName) {
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
   * @param {string} opId - Operation ID from startOperation
   * @param {object} metadata - Additional metadata to log
   */
  endOperation(opId, metadata = {}) {
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

  /**
   * Log info level message
   */
  info(message, metadata = {}) {
    return this._log('info', message, metadata);
  }

  /**
   * Log warning level message
   */
  warn(message, metadata = {}) {
    return this._log('warn', message, metadata);
  }

  /**
   * Log error level message
   */
  error(message, error = null, metadata = {}) {
    const errorData = error ? {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        // Categorize common error types
        type: categorizeError(error),
      }
    } : {};

    return this._log('error', message, { ...metadata, ...errorData });
  }

  /**
   * Log debug level message
   */
  debug(message, metadata = {}) {
    return this._log('debug', message, metadata);
  }

  /**
   * Internal log method
   */
  _log(level, message, metadata = {}) {
    const logData = {
      level,
      message,
      context: this.context,
      requestId: this.requestId,
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    // Console output in development
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${level.toUpperCase()}] [${this.requestId}] [${this.context}] ${message}`,
        Object.keys(metadata).length > 0 ? metadata : '');
    }

    // Send to Axiom
    try {
      this.axiomLogger.log(level, message, {
        context: this.context,
        requestId: this.requestId,
        ...metadata,
      });
    } catch (error) {
      // Suppress terminal-related errors in serverless environments
      if (!error?.message?.includes('terminal') && !error?.message?.includes('Cannot read properties of undefined')) {
        console.error('Error logging to Axiom:', error);
      }
    }

    return logData;
  }

  /**
   * Flush logs to Axiom (call this at the end of API routes)
   */
  async flush() {
    try {
      await this.axiomLogger.flush();
    } catch (error) {
      if (error?.message?.includes('terminal') || error?.message?.includes('Cannot read properties of undefined')) {
        return;
      }
      console.error('Failed to flush logs to Axiom:', error);
    }
  }
}

/**
 * Categorize error types for easier filtering
 */
function categorizeError(error) {
  const message = error?.message?.toLowerCase() || '';
  const name = error?.name || '';

  if (name === 'PlaidError' || message.includes('plaid')) return 'plaid';
  if (message.includes('network') || message.includes('fetch') || message.includes('econnrefused')) return 'network';
  if (message.includes('timeout') || message.includes('timed out')) return 'timeout';
  if (message.includes('rate limit') || message.includes('429')) return 'rate_limit';
  if (message.includes('unauthorized') || message.includes('401') || message.includes('403')) return 'auth';
  if (message.includes('not found') || message.includes('404')) return 'not_found';
  if (message.includes('validation') || message.includes('invalid')) return 'validation';
  if (message.includes('database') || message.includes('supabase') || message.includes('postgres')) return 'database';
  return 'unknown';
}

/**
 * Create a logger instance for a specific context
 * @param {string} context - The context/module name (e.g., 'plaid-webhook', 'api-transactions')
 * @param {string} requestId - Optional request ID for correlation
 * @returns {Logger}
 */
export function createLogger(context, requestId = null) {
  return new Logger(context, requestId);
}

/**
 * Wrap an API route handler with automatic logging
 * Logs request start, completion, and errors with timing
 *
 * @param {string} routeName - Name of the route for logging context
 * @param {Function} handler - The route handler function (request, context) => Response
 * @returns {Function} - Wrapped handler
 *
 * @example
 * export const POST = withLogging('plaid-webhook', async (request, { logger }) => {
 *   logger.info('Processing webhook');
 *   return Response.json({ success: true });
 * });
 */
export function withLogging(routeName, handler) {
  return async (request, routeContext = {}) => {
    const logger = createLogger(routeName);
    const startTime = performance.now();

    // Extract request info
    const method = request.method;
    const url = request.url;
    const userAgent = request.headers?.get?.('user-agent') || 'unknown';

    logger.info('Request started', {
      method,
      url,
      userAgent: userAgent.substring(0, 100), // Truncate long user agents
    });

    try {
      // Call the handler with logger injected
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

      logger.error('Request failed', error, {
        method,
        url,
        durationMs: duration,
      });

      await logger.flush();

      // Re-throw to let Next.js handle the error response
      throw error;
    }
  };
}

/**
 * Default logger instance
 */
export const logger = new Logger('app');

export default logger;
