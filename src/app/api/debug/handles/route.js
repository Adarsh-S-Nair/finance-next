import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const handles = typeof process._getActiveHandles === 'function' ? process._getActiveHandles() : [];
    const requests = typeof process._getActiveRequests === 'function' ? process._getActiveRequests() : [];

    const byType = {};
    for (const h of handles) {
      const name = (h && h.constructor && h.constructor.name) || 'Unknown';
      byType[name] = (byType[name] || 0) + 1;
    }

    return NextResponse.json({
      pid: process.pid,
      handles: { total: handles.length, byType },
      requests: { total: requests.length },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}






