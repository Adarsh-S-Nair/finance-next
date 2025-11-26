"use client";

import { useState } from 'react';

export default function TestLogsButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleTestLogs = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/test-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: 'manual-test' }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({ success: true, message: data.message });
        // Auto-clear success message after 5 seconds
        setTimeout(() => setResult(null), 5000);
      } else {
        setResult({ success: false, message: data.error || 'Failed to send logs' });
      }
    } catch (error) {
      setResult({ success: false, message: 'Network error: ' + error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleTestLogs}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="text-base">🧪</span>
        {loading ? 'Sending...' : 'Test Axiom Logs'}
      </button>

      {result && (
        <div
          className={`text-xs px-3 py-1.5 rounded-md animate-in fade-in slide-in-from-top-2 ${result.success
              ? 'bg-green-500/10 text-green-600 dark:text-green-400'
              : 'bg-red-500/10 text-red-600 dark:text-red-400'
            }`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}
