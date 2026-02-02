/**
 * Log Query API - Queries Axiom logs for debugging
 *
 * This endpoint allows AI agents and developers to search through logs
 * stored in Axiom for debugging purposes.
 *
 * POST /api/logs/query
 *
 * Body:
 * {
 *   "query": "error",           // Search term (optional)
 *   "context": "plaid-webhook", // Filter by context (optional)
 *   "level": "error",           // Filter by level: debug, info, warn, error (optional)
 *   "requestId": "abc123",      // Filter by correlation ID (optional)
 *   "startTime": "2024-01-01",  // Start of time range (optional, default: 1 hour ago)
 *   "endTime": "2024-01-02",    // End of time range (optional, default: now)
 *   "limit": 100                // Max results (optional, default: 100, max: 1000)
 * }
 */

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      query,
      context,
      level,
      requestId,
      startTime,
      endTime,
      limit = 100,
    } = body;

    const dataset = process.env.NEXT_PUBLIC_AXIOM_DATASET;
    const token = process.env.AXIOM_TOKEN;

    if (!dataset || !token) {
      return Response.json(
        { error: 'Axiom not configured. Missing NEXT_PUBLIC_AXIOM_DATASET or AXIOM_TOKEN.' },
        { status: 500 }
      );
    }

    // Build APL query
    const filters = [];

    if (query) {
      // Search across message and error fields
      filters.push(`message contains "${escapeApl(query)}" or ['error.message'] contains "${escapeApl(query)}"`);
    }

    if (context) {
      filters.push(`context == "${escapeApl(context)}" or context startswith "${escapeApl(context)}:"`);
    }

    if (level) {
      filters.push(`level == "${escapeApl(level)}"`);
    }

    if (requestId) {
      filters.push(`requestId == "${escapeApl(requestId)}"`);
    }

    // Build the full APL query
    const whereClause = filters.length > 0 ? `| where ${filters.join(' and ')}` : '';
    const aplQuery = `['${dataset}'] ${whereClause} | sort by _time desc | limit ${Math.min(limit, 1000)}`;

    // Calculate time range
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

    const queryStartTime = startTime ? new Date(startTime).toISOString() : defaultStart.toISOString();
    const queryEndTime = endTime ? new Date(endTime).toISOString() : now.toISOString();

    // Query Axiom
    const response = await fetch('https://api.axiom.co/v1/datasets/_apl', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apl: aplQuery,
        startTime: queryStartTime,
        endTime: queryEndTime,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Axiom query failed:', response.status, errorText);
      return Response.json(
        { error: `Axiom query failed: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Format the response for easier consumption
    const logs = (result.matches || []).map(match => ({
      timestamp: match._time,
      level: match.level,
      message: match.message,
      context: match.context,
      requestId: match.requestId,
      error: match.error,
      // Include any additional fields
      ...Object.fromEntries(
        Object.entries(match).filter(([key]) =>
          !['_time', '_sysTime', 'level', 'message', 'context', 'requestId', 'error'].includes(key)
        )
      ),
    }));

    return Response.json({
      success: true,
      query: {
        apl: aplQuery,
        startTime: queryStartTime,
        endTime: queryEndTime,
      },
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error('Error querying logs:', error);
    return Response.json(
      { error: 'Failed to query logs', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for simple queries
 *
 * GET /api/logs/query?q=error&context=plaid&level=error&hours=24
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get('q');
  const context = searchParams.get('context');
  const level = searchParams.get('level');
  const requestId = searchParams.get('requestId');
  const hours = parseInt(searchParams.get('hours') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  // Calculate time range based on hours parameter
  const now = new Date();
  const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

  // Reuse POST logic
  const mockRequest = {
    json: async () => ({
      query,
      context,
      level,
      requestId,
      startTime,
      limit,
    }),
  };

  return POST(mockRequest);
}

/**
 * Escape special characters for APL queries
 */
function escapeApl(str) {
  if (!str) return '';
  return str.replace(/["\\]/g, '\\$&');
}
