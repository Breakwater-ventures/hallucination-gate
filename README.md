# Hallucination Gate

**Fact-check any claim against source material. Pay per call. No API keys.**

Hallucination Gate is an [x402](https://x402.org)-enabled API that verifies factual claims against provided source text using multi-model LLM analysis. AI agents pay $0.03 USDC per verification call on Base — no accounts, no API keys, no rate limits.

## Why

LLMs hallucinate. When agents generate responses that include facts, figures, or claims from source documents, those claims can be wrong. Hallucination Gate catches contradictions, numerical errors, and unsupported assertions before they reach the user.

## Endpoints

| Endpoint | Price | Description |
|----------|-------|-------------|
| `POST /verify` | $0.03 USDC | Basic single-pass verification |
| `POST /verify/deep` | $0.10 USDC | Multi-pass deep verification with claim decomposition |
| `GET /health` | Free | Health check |
| `GET /stats` | Free | Service statistics |
| `GET /` | Free | API documentation |

## Quick Start

```bash
# Without payment (returns 402 with payment instructions)
curl -X POST https://YOUR_URL/verify \
  -H "Content-Type: application/json" \
  -d '{
    "claim": "Apple reported revenue of $94.9 billion in Q1 2024",
    "source": "Apple Inc. reported fiscal first-quarter revenue of $119.6 billion."
  }'

# Response: 402 Payment Required with x402 payment header
```

## Request

```json
{
  "claim": "The factual claim to verify",
  "source": "Source text to verify against (up to 50,000 characters)",
  "context": "Optional additional context"
}
```

## Response

```json
{
  "verdict": "contradicted",
  "confidence": 1.0,
  "evidence": "Source states Apple reported $119.6B in revenue, not $94.9B as claimed.",
  "summary": "The claimed revenue figure is directly contradicted by the source.",
  "meta": {
    "model": "gemini-2.5-flash",
    "latency_ms": 2740,
    "tier": "basic"
  }
}
```

### Verdicts

| Verdict | Meaning |
|---------|---------|
| `supported` | Source directly supports the claim |
| `contradicted` | Source contradicts the claim |
| `unsupported` | Source doesn't contain enough info to verify |
| `unverifiable` | Claim is about something the source doesn't address |

## Integration

### Using @x402/fetch (recommended)

```javascript
import { wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';

const signer = privateKeyToAccount(PRIVATE_KEY);
const client = new x402Client();
registerExactEvmScheme(client, { signer });
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

const response = await fetchWithPayment('https://YOUR_URL/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    claim: 'Apple reported revenue of $94.9 billion in Q1 2024',
    source: 'Apple Inc. reported fiscal first-quarter revenue of $119.6 billion.'
  })
});

const result = await response.json();
console.log(result.verdict); // "contradicted"
```

## x402 Protocol

This service uses the [x402 payment protocol](https://x402.org) — an HTTP-native micropayment standard using USDC on Base.

- **Network**: Base Mainnet (eip155:8453)
- **Token**: USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
- **Facilitator**: PayAI (https://facilitator.payai.network)
- **No API keys required** — payment is the authentication

## Deploy Your Own

```bash
git clone https://github.com/hallucination-gate/hallucination-gate.git
cd hallucination-gate
cp .env.example .env
# Edit .env with your wallet address and Gemini API key
npm install
npm start
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PAY_TO_ADDRESS` | Yes | Your EVM wallet address for receiving payments |
| `GEMINI_API_KEY` | Yes | Google Gemini API key (free tier works) |
| `FACILITATOR_URL` | No | x402 facilitator (default: PayAI) |
| `NETWORK` | No | CAIP-2 network ID (default: eip155:8453) |
| `PORT` | No | Server port (default: 4021) |

### Deploy to Render (one click)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## License

MIT
