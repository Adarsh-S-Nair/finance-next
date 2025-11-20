import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const usage = process.memoryUsage();
    let v8Stats = null;
    try {
      const v8 = await import('v8');
      v8Stats = v8.getHeapStatistics();
    } catch {
      // v8 may not be available in some environments
    }

    const toMB = (n) => Math.round((n / (1024 * 1024)) * 100) / 100;

    const summary = {
      rssMB: toMB(usage.rss),
      heapUsedMB: toMB(usage.heapUsed),
      heapTotalMB: toMB(usage.heapTotal),
      externalMB: toMB(usage.external),
      arrayBuffersMB: toMB(usage.arrayBuffers || 0),
    };

    return NextResponse.json({
      process: {
        pid: process.pid,
        node: process.version,
        platform: process.platform,
        uptimeSec: Math.round(process.uptime()),
      },
      memory: usage,
      summary,
      v8: v8Stats || undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}





