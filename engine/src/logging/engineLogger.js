class EngineLogger {
  info(message, context = {}) {
    this.log('info', message, context);
  }

  warn(message, context = {}) {
    this.log('warn', message, context);
  }

  error(message, context = {}) {
    this.log('error', message, context);
  }

  log(level, message, context = {}) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };
    console.log(JSON.stringify(payload));
  }

  evaluation(payload) {
    this.info('engine_evaluation', payload);
  }
}

module.exports = {
  EngineLogger,
};
