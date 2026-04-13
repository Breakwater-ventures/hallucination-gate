/**
 * Simple metrics tracking for Hallucination Gate
 * Logs requests to a JSONL file and provides summary stats.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = path.join(__dirname, 'request-log.jsonl');

export function logRequest({ endpoint, elapsed, verdict }) {
  const entry = {
    ts: new Date().toISOString(),
    endpoint,
    elapsed,
    verdict,
  };
  fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n');
}

export function getStats() {
  if (!fs.existsSync(LOG_PATH)) {
    return { total_requests: 0, revenue_estimate_usdc: 0, uptime_hours: process.uptime() / 3600 };
  }

  const lines = fs.readFileSync(LOG_PATH, 'utf-8').trim().split('\n').filter(Boolean);
  const entries = lines.map(l => JSON.parse(l));

  const basic = entries.filter(e => e.endpoint === '/verify').length;
  const deep = entries.filter(e => e.endpoint === '/verify/deep').length;
  const revenue = (basic * 0.03) + (deep * 0.10);

  const verdicts = {};
  entries.forEach(e => {
    verdicts[e.verdict] = (verdicts[e.verdict] || 0) + 1;
  });

  const avgLatency = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + e.elapsed, 0) / entries.length)
    : 0;

  return {
    total_requests: entries.length,
    basic_calls: basic,
    deep_calls: deep,
    revenue_estimate_usdc: revenue.toFixed(2),
    avg_latency_ms: avgLatency,
    verdict_distribution: verdicts,
    uptime_hours: (process.uptime() / 3600).toFixed(2),
    first_request: entries[0]?.ts || null,
    last_request: entries[entries.length - 1]?.ts || null,
  };
}
