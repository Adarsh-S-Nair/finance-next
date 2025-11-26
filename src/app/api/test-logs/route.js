import { createLogger } from '../../../lib/logger';

const logger = createLogger('test-logs');

export async function POST(request) {
  try {
    const { testType = 'general' } = await request.json();

    // Send various test logs
    logger.info('Test log - INFO level', {
      testType,
      timestamp: new Date().toISOString(),
      message: 'This is a test info log from your finance app',
      data: {
        userAgent: request.headers.get('user-agent'),
        environment: process.env.NODE_ENV,
      }
    });

    logger.warn('Test log - WARNING level', {
      testType,
      warningMessage: 'This is a test warning to demonstrate different log levels',
    });

    logger.debug('Test log - DEBUG level', {
      testType,
      debugData: {
        randomValue: Math.random(),
        processPid: process.pid,
      }
    });

    // Simulate an error log without actually throwing
    logger.error('Test log - ERROR level (simulated)', null, {
      testType,
      errorContext: 'This is a simulated error for testing purposes',
      additionalInfo: {
        severity: 'test',
        recoverable: true,
      }
    });

    // Flush logs to Axiom
    await logger.flush();

    return Response.json({
      success: true,
      message: 'Test logs sent to Axiom successfully! Check your Axiom dashboard.',
      logsGenerated: 4,
      dataset: process.env.NEXT_PUBLIC_AXIOM_DATASET,
    });

  } catch (error) {
    logger.error('Failed to send test logs', error);
    await logger.flush();

    return Response.json(
      { error: 'Failed to send test logs', details: error.message },
      { status: 500 }
    );
  }
}
