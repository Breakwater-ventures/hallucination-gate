# Hallucination Gate — Revenue Plan

## Goal
Earn $100 USDC from agent payments within 30 days.

## Status (April 12, 2026)
- [x] Core verification engine built (Gemini 2.5 Flash)
- [x] x402 payment middleware integrated
- [x] Base mainnet configured (PayAI facilitator)
- [x] E2E payment test passed (TX 0x8b97939492fecd3b)
- [x] Landing page deployed
- [x] Bazaar discovery metadata added
- [ ] Permanent hosting (Render/Railway/Fly.io)
- [ ] GitHub repo public
- [ ] awesome-x402 PR submitted
- [ ] MCP registry submission
- [ ] Distribution posts (Reddit, HN, X)

## Revenue Model

| Tier | Price | LLM Cost | Margin | Calls to $100 |
|------|-------|----------|--------|----------------|
| Basic | $0.03 | ~$0.001 | ~97% | 3,334 |
| Deep | $0.10 | ~$0.005 | ~95% | 1,000 |

Blended estimate (80% basic, 20% deep): ~$0.044/call avg → 2,273 calls → ~76/day for 30 days.

## Budget

| Item | Cost | Status |
|------|------|--------|
| Gemini API | $0 (free tier) | Active |
| Hosting | $0-5/month (free tier) | Pending |
| PayAI facilitator | 0.2% of revenue | Active |
| Domain (optional) | $12/year | Optional |
| **Total fixed cost** | **$0-5/month** | |

## Distribution Strategy

### Phase 1: x402 ecosystem (Week 1)
- x402 Bazaar (auto-registered via PayAI)
- awesome-x402 GitHub repos (Merit-Systems, xpaysh)
- x402 Discord
- Coinbase Developer community

### Phase 2: AI/agent communities (Week 1-2)
- r/mcp, r/LocalLLaMA, r/artificial
- Hacker News (Show HN)
- AI Discord servers (LlamaIndex, LangChain)

### Phase 3: Crypto/payments communities (Week 2-3)
- r/ethdev, r/basechain
- Crypto Twitter / X thread
- Base ecosystem Discord

### Phase 4: Direct agent integration (Week 2-4)
- MCP tool registry (mcp.so, Smithery)
- Integration guides for LangChain, LlamaIndex, AutoGPT
- Submit as tool to agent frameworks

## Revenue Earned
- **April 12**: $0.03 (E2E test — first payment)
- **Total**: $0.03 / $100.00 target

## What Would Multiply Usage
1. **MCP integration** — any agent using MCP can discover and call this tool automatically
2. **LangChain/LlamaIndex tool adapter** — drop-in verification for any RAG pipeline
3. **Batch verification endpoint** — verify multiple claims in one call (higher price, more value)
4. **Verifiable credentials** — return a signed attestation that the claim was verified (composable trust)
