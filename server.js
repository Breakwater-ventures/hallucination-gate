/**
 * Hallucination Gate — Agent Verification API
 * 
 * x402-enabled endpoint that verifies whether a claim is supported
 * by provided source material. Agents pay USDC on Base per call.
 * 
 * Endpoints:
 *   POST /verify       — $0.03 USDC — Basic single-model verification
 *   POST /verify/deep  — $0.10 USDC — Multi-pass deep verification
 *   GET  /health       — Free — Health check
 *   GET  /              — Free — API documentation
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { paymentMiddleware } from '@x402/express';
import { x402ResourceServer, HTTPFacilitatorClient } from '@x402/core/server';
import { bazaarResourceServerExtension, declareDiscoveryExtension } from '@x402/extensions/bazaar';
// ExactEvmScheme imported dynamically below
import { verifyClaim, verifyClaimDeep } from './verify.js';
import { logRequest, getStats } from './metrics.js';

const app = express();
const PORT = process.env.PORT || 4021;
const PAY_TO = process.env.PAY_TO_ADDRESS;
const NETWORK = process.env.NETWORK || 'eip155:84532';

if (!PAY_TO) throw new Error('PAY_TO_ADDRESS required in .env');

// --- CORS ---
app.use(cors({
  origin: true,
  exposedHeaders: ['payment-required', 'payment-response'],
}));

app.use(express.json({ limit: '500kb' }));

// --- x402 Setup ---
const facilitator = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL || 'https://x402.org/facilitator',
});
const resourceServer = new x402ResourceServer(facilitator);
resourceServer.register('eip155:*', new (await import('@x402/evm/exact/server')).ExactEvmScheme());
try { resourceServer.registerExtension(bazaarResourceServerExtension); } catch (e) { console.warn('[bazaar] Extension registration skipped:', e.message); }

// --- x402 Payment Middleware ---
app.use(paymentMiddleware({
  'POST /verify': {
    accepts: [{
      scheme: 'exact',
      price: '$0.03',
      network: NETWORK,
      payTo: PAY_TO,
    }],
    description: 'Verify a claim against source material. Returns verdict (supported/unsupported/contradicted), confidence score, and evidence.',
    mimeType: 'application/json',
    extensions: {
      ...declareDiscoveryExtension({
        input: {
          claim: 'Apple reported revenue of $94.9 billion in Q1 2024',
          source: 'Apple Inc. reported fiscal first-quarter revenue of $119.6 billion.',
        },
        inputSchema: {
          properties: {
            claim: { type: 'string', description: 'The factual claim to verify' },
            source: { type: 'string', description: 'Source text to verify against (up to 50,000 chars)' },
            context: { type: 'string', description: 'Optional additional context' },
          },
          required: ['claim', 'source'],
        },
        bodyType: 'json',
        output: {
          example: {
            verdict: 'contradicted',
            confidence: 1.0,
            evidence: 'Source states $119.6B, not $94.9B.',
            summary: 'Revenue figure directly contradicted.',
          },
          schema: {
            properties: {
              verdict: { type: 'string', enum: ['supported', 'contradicted', 'unsupported', 'unverifiable'] },
              confidence: { type: 'number' },
              evidence: { type: 'string' },
              summary: { type: 'string' },
            },
          },
        },
      }),
    },
  },
  'POST /verify/deep': {
    accepts: [{
      scheme: 'exact',
      price: '$0.10',
      network: NETWORK,
      payTo: PAY_TO,
    }],
    description: 'Deep multi-pass verification with claim decomposition, reasoning chain, evidence extraction, and confidence calibration.',
    mimeType: 'application/json',
    extensions: {
      ...declareDiscoveryExtension({
        input: {
          claim: 'The company grew revenue 15% YoY to $2.5B while maintaining 25% EBITDA margins',
          source: 'Revenue was $2.1B, up 12% year-over-year. Adjusted EBITDA margin was 23%.',
        },
        inputSchema: {
          properties: {
            claim: { type: 'string', description: 'Complex claim with multiple facts to verify' },
            source: { type: 'string', description: 'Source text to verify against' },
            context: { type: 'string', description: 'Optional context' },
          },
          required: ['claim', 'source'],
        },
        bodyType: 'json',
        output: {
          example: {
            verdict: 'contradicted',
            confidence: 0.95,
            reasoning: 'All three sub-claims are contradicted: revenue was $2.1B not $2.5B, growth was 12% not 15%, and margins were 23% not 25%.',
            subclaim_results: [],
            flags: ['numerical_mismatch', 'multiple_contradictions'],
          },
        },
      }),
    },
  },
}, resourceServer));

// --- Free Endpoints ---

app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', uptime: process.uptime() });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Hallucination Gate',
    description: 'Agent verification API — verify claims against source material via x402 micropayments.',
    version: '1.0.0',
    pricing: {
      'POST /verify': { price: '$0.03 USDC', network: 'Base', description: 'Basic verification' },
      'POST /verify/deep': { price: '$0.10 USDC', network: 'Base', description: 'Deep multi-pass verification' },
    },
    usage: {
      request: {
        claim: 'string — The factual claim to verify',
        source: 'string — Source text to verify against (up to 50,000 chars)',
        context: 'string (optional) — Additional context about the domain or claim',
      },
      response: {
        verdict: 'supported | unsupported | contradicted | unverifiable',
        confidence: 'number 0-1',
        evidence: 'string — Specific passage from source supporting the verdict',
        reasoning: 'string — Chain of reasoning (deep only)',
        flags: 'array — Specific issues found (deep only)',
      },
    },
    examples: {
      basic: {
        method: 'POST',
        url: '/verify',
        body: {
          claim: 'Apple reported revenue of $94.9 billion in Q1 2024',
          source: 'Apple Inc. reported fiscal first-quarter revenue of $119.6 billion, an increase of 4 percent year over year.',
        },
        expected_response: {
          verdict: 'contradicted',
          confidence: 0.95,
          evidence: 'Source states Apple reported $119.6B in revenue, not $94.9B as claimed.',
        },
      },
    },
    links: {
      documentation: 'https://hallucination-gate.com',
      x402_protocol: 'https://x402.org',
      github: 'https://github.com/southpoint/hallucination-gate',
    },
  });
});

app.get('/stats', (req, res) => {
  const stats = getStats();
  res.json(stats);
});

// --- Paid Endpoints ---

app.post('/verify', async (req, res) => {
  const start = Date.now();
  try {
    const { claim, source, context } = req.body;

    if (!claim || !source) {
      return res.status(400).json({
        error: 'Missing required fields: claim and source',
        usage: { claim: 'string', source: 'string', context: 'string (optional)' },
      });
    }

    if (source.length > 50000) {
      return res.status(400).json({ error: 'Source text exceeds 50,000 character limit' });
    }

    const result = await verifyClaim(claim, source, context);
    const elapsed = Date.now() - start;

    logRequest({ endpoint: '/verify', elapsed, verdict: result.verdict });

    res.json({
      ...result,
      meta: {
        model: 'gemini-2.5-flash',
        latency_ms: elapsed,
        tier: 'basic',
      },
    });

  } catch (err) {
    console.error('[verify] Error:', err.message);
    res.status(500).json({ error: 'Verification failed', detail: err.message });
  }
});

app.post('/verify/deep', async (req, res) => {
  const start = Date.now();
  try {
    const { claim, source, context } = req.body;

    if (!claim || !source) {
      return res.status(400).json({
        error: 'Missing required fields: claim and source',
        usage: { claim: 'string', source: 'string', context: 'string (optional)' },
      });
    }

    if (source.length > 50000) {
      return res.status(400).json({ error: 'Source text exceeds 50,000 character limit' });
    }

    const result = await verifyClaimDeep(claim, source, context);
    const elapsed = Date.now() - start;

    logRequest({ endpoint: '/verify/deep', elapsed, verdict: result.verdict });

    res.json({
      ...result,
      meta: {
        model: 'gemini-2.5-flash (multi-pass)',
        latency_ms: elapsed,
        tier: 'deep',
      },
    });

  } catch (err) {
    console.error('[verify/deep] Error:', err.message);
    res.status(500).json({ error: 'Deep verification failed', detail: err.message });
  }
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`\n🔒 Hallucination Gate v1.0.0`);
  console.log(`   Listening on port ${PORT}`);
  console.log(`   Payments to: ${PAY_TO}`);
  console.log(`   Facilitator: ${process.env.FACILITATOR_URL}`);
  console.log(`   Network: Base Mainnet (eip155:8453)\n`);
});
