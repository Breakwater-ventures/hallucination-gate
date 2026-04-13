# Deployment Guide — Hallucination Gate

## Current Status (April 12, 2026)
- **Temporary URL**: https://split-abroad-delivery-manufacture.trycloudflare.com (Cloudflare tunnel, session-only)
- **First payment received**: TX 0x8b97939492fecd3b on Base mainnet ($0.03 USDC)
- **Revenue to date**: $0.03

## Permanent Deployment Options

### Option 1: Render.com (Recommended — free tier)

1. Push code to a GitHub repo
2. Go to https://render.com → New → Web Service
3. Connect the repo
4. Set build command: `npm ci --omit=dev`
5. Set start command: `node server.js`
6. Add environment variables:
   - `PAY_TO_ADDRESS` = `0x4e817866Fe867412A261facF616E9f4d53bD9B45`
   - `GEMINI_API_KEY` = your key
   - `FACILITATOR_URL` = `https://facilitator.payai.network`
   - `NETWORK` = `eip155:8453`
   - `PORT` = `4021`
7. Deploy

Render free tier: 750 hours/month, auto-deploy from GitHub, custom domains, managed TLS.

### Option 2: Railway

1. Push to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Railway auto-detects Node.js
4. Add env vars (same as above)
5. Generate a domain in Settings

Railway: $5/month hobby plan with generous included credits.

### Option 3: Fly.io

```bash
flyctl auth login
cd hallucination-gate
flyctl launch --name hallucination-gate
flyctl secrets set PAY_TO_ADDRESS=0x4e817866Fe867412A261facF616E9f4d53bD9B45
flyctl secrets set GEMINI_API_KEY=your_key
flyctl secrets set FACILITATOR_URL=https://facilitator.payai.network
flyctl secrets set NETWORK=eip155:8453
flyctl deploy
```

## After Deployment

Once you have a permanent URL, update:
1. Landing page API examples (currently pointing to trycloudflare URL)
2. README.md examples
3. x402 Bazaar discovery will auto-register through PayAI facilitator
4. Submit to awesome-x402 repos and MCP directories

## Architecture Notes

- **LLM Backend**: Gemini 2.5 Flash (free tier, 5 RPM). Retry with exponential backoff handles rate limits.
- **Facilitator**: PayAI (https://facilitator.payai.network) — no auth needed, supports Base mainnet.
- **Payment flow**: Agent → 402 response → agent signs EIP-3009 USDC transfer → facilitator verifies + settles → server returns verification result.
- **Revenue**: $0.03/basic call, $0.10/deep call. ~90%+ margin (LLM cost is ~$0.001-$0.003/call on Gemini free tier).
