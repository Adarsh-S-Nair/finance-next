import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST() {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Heap snapshot allowed only in development' }, { status: 403 });
    }
    if (process.env.DEBUG_HEAP !== '1') {
      return NextResponse.json({ error: 'Enable DEBUG_HEAP=1 to use this endpoint' }, { status: 403 });
    }

    const v8 = await import('v8');
    const dir = path.join(process.cwd(), '.next', 'cache', 'heap');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `heap-${Date.now()}.heapsnapshot`);
    const stream = v8.writeHeapSnapshot(file);
    // writeHeapSnapshot returns filename (string) in some Node versions; handle both
    const filePath = typeof stream === 'string' ? stream : file;
    const stat = fs.statSync(filePath);
    return NextResponse.json({ file: filePath, sizeBytes: stat.size });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}





