#!/usr/bin/env node
/**
 * Hallucination Gate MCP Server
 * 
 * Exposes fact-checking tools via MCP protocol.
 * Agents with x402-enabled wallets can verify claims against source material.
 * 
 * Two tools:
 *   - verify_claim: Basic single-pass verification ($0.03 USDC)
 *   - verify_claim_deep: Multi-pass deep verification ($0.10 USDC)
 * 
 * Usage:
 *   EVM_PRIVATE_KEY=0x... HALLUCINATION_GATE_URL=https://... node index.js
 * 
 * Claude Desktop config (claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "hallucination-gate": {
 *         "command": "npx",
 *         "args": ["hallucination-gate-mcp"],
 *         "env": {
 *           "EVM_PRIVATE_KEY": "0x...",
 *           "HALLUCINATION_GATE_URL": "https://hallucination-gate.onrender.com"
 *         }
 *       }
 *     }
 *   }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { config } from 'dotenv';

config();

const BASE_URL = process.env.HALLUCINATION_GATE_URL || 'https://hallucination-gate.onrender.com';
const EVM_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY;

let fetchWithPayment;

async function initPaymentClient() {
  if (!EVM_PRIVATE_KEY) {
    console.error('[hallucination-gate-mcp] Warning: No EVM_PRIVATE_KEY set. Calls will return 402 Payment Required.');
    return null;
  }

  try {
    const { wrapFetchWithPayment, x402Client } = await import('@x402/fetch');
    const { registerExactEvmScheme } = await import('@x402/evm/exact/client');
    const { privateKeyToAccount } = await import('viem/accounts');

    const signer = privateKeyToAccount(EVM_PRIVATE_KEY);
    const client = new x402Client();
    registerExactEvmScheme(client, { signer });
    fetchWithPayment = wrapFetchWithPayment(fetch, client);
    console.error(`[hallucination-gate-mcp] Payment client initialized. Wallet: ${signer.address}`);
    return fetchWithPayment;
  } catch (err) {
    console.error(`[hallucination-gate-mcp] Failed to init payment client: ${err.message}`);
    return null;
  }
}

async function callAPI(endpoint, body) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };

  const f = fetchWithPayment || fetch;
  const res = await f(url, options);

  if (res.status === 402) {
    throw new Error('Payment required. Set EVM_PRIVATE_KEY with a funded Base USDC wallet.');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 500)}`);
  }

  return await res.json();
}

async function main() {
  await initPaymentClient();

  const server = new McpServer({
    name: 'hallucination-gate',
    version: '1.0.0',
  });

  // Tool 1: Basic verification ($0.03)
  server.tool(
    'verify_claim',
    'Verify a factual claim against source material. Returns verdict (supported/contradicted/unsupported/unverifiable), confidence score, and evidence. Costs $0.03 USDC on Base via x402.',
    {
      claim: z.string().describe('The factual claim to verify (e.g., "Apple reported revenue of $94.9 billion in Q1 2024")'),
      source: z.string().describe('Source text to verify the claim against (up to 50,000 characters)'),
      context: z.string().optional().describe('Optional additional context for verification'),
    },
    async ({ claim, source, context }) => {
      try {
        const result = await callAPI('/verify', { claim, source, context });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 2: Deep verification ($0.10)
  server.tool(
    'verify_claim_deep',
    'Deep multi-pass verification: decomposes complex claims into sub-claims, verifies each independently, then synthesizes an overall verdict. Best for claims with multiple facts or numbers. Costs $0.10 USDC on Base via x402.',
    {
      claim: z.string().describe('Complex claim with multiple facts to verify'),
      source: z.string().describe('Source text to verify against'),
      context: z.string().optional().describe('Optional additional context'),
    },
    async ({ claim, source, context }) => {
      try {
        const result = await callAPI('/verify/deep', { claim, source, context });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // Tool 3: Health check (free)
  server.tool(
    'hallucination_gate_status',
    'Check if the Hallucination Gate service is online. Free — no payment required.',
    {},
    async () => {
      try {
        const res = await fetch(`${BASE_URL}/health`);
        const data = await res.json();
        return {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: 'text', text: `Service unreachable: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[hallucination-gate-mcp] MCP server running on stdio');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
