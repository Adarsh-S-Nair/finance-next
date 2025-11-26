import { Logger as AxiomLogger } from 'next-axiom';

/**
 * Logger utility for Axiom
 * Provides structured logging with automatic metadata
 */
class Logger {
  constructor(context = '') {
    this.context = context;
    this.axiomLogger = new AxiomLogger();
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
      timestamp: new Date().toISOString(),
      ...metadata,
    };

    console.log(`[${level.toUpperCase()}] [${this.context}] ${message}`, metadata);

    // Send to Axiom using next-axiom's logger
    this.axiomLogger.log(level, message, {
      context: this.context,
      ...metadata,
    });

    return logData;
  }

  /**
   * Flush logs to Axiom (call this at the end of API routes)
   */
  async flush() {
    try {
      await this.axiomLogger.flush();
    } catch (error) {
      console.error('Failed to flush logs to Axiom:', error);
    }
  }
}

/**
 * Create a logger instance for a specific context
 * @param {string} context - The context/module name (e.g., 'plaid-webhook', 'api-transactions')
 * @returns {Logger}
 */
export function createLogger(context) {
  return new Logger(context);
}

/**
 * Default logger instance
 */
export const logger = new Logger('app');

export default logger;
