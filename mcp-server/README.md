# Hallucination Gate MCP Server

MCP (Model Context Protocol) server that gives any AI agent access to fact-checking via [Hallucination Gate](https://github.com/Breakwater-ventures/hallucination-gate).

Agents pay $0.03 USDC per verification on Base — no API keys, no accounts.

## Tools

| Tool | Cost | Description |
|------|------|-------------|
| `verify_claim` | $0.03 USDC | Basic single-pass claim verification |
| `verify_claim_deep` | $0.10 USDC | Multi-pass deep verification with claim decomposition |
| `hallucination_gate_status` | Free | Service health check |

## Quick Start

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "hallucination-gate": {
      "command": "npx",
      "args": ["hallucination-gate-mcp"],
      "env": {
        "EVM_PRIVATE_KEY": "0xYourPrivateKey",
        "HALLUCINATION_GATE_URL": "https://hallucination-gate.onrender.com"
      }
    }
  }
}
```

### Any MCP Client

```bash
EVM_PRIVATE_KEY=0x... npx hallucination-gate-mcp
```

## Requirements

- Node.js 18+
- EVM wallet with USDC on Base (for paid tools)
- Private key for signing x402 payments

## How It Works

1. Agent calls `verify_claim` with a claim and source text
2. MCP server forwards to Hallucination Gate API
3. Server returns 402 — x402 client auto-signs USDC payment
4. Verification result returned to agent

Payment is handled transparently via the x402 protocol. The agent never needs to manage payments manually.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EVM_PRIVATE_KEY` | Yes | Hex private key for USDC payments |
| `HALLUCINATION_GATE_URL` | No | API URL (default: hallucination-gate.onrender.com) |

## License

MIT
