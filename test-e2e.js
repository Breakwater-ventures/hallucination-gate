/**
 * End-to-end test: Pay USDC on Base mainnet → get verification result
 * Uses the x402 client wallet to make a real paid request
 */

const { fetchWithPayment, getWalletBalance } = require('../x402-client/x402-fetch.js');

const PUBLIC_URL = process.argv[2] || 'https://split-abroad-delivery-manufacture.trycloudflare.com';

async function main() {
  console.log('=== Hallucination Gate E2E Test ===\n');

  // 1. Check wallet balance
  console.log('1. Checking wallet balance...');
  const balance = await getWalletBalance();
  console.log(`   Wallet: ${balance.address}`);
  console.log(`   Balance: ${balance.balanceUSDC} USDC on ${balance.network}\n`);

  if (parseFloat(balance.balanceUSDC) < 0.05) {
    console.error('   ⚠ Insufficient balance for testing. Need at least $0.05 USDC.');
    process.exit(1);
  }

  // 2. Test basic verification ($0.03)
  console.log('2. Testing /verify (basic — $0.03 USDC)...');
  const basicRes = await fetchWithPayment(`${PUBLIC_URL}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      claim: 'Apple reported revenue of $94.9 billion in Q1 2024.',
      source: 'Apple Inc. reported fiscal first-quarter revenue of $119.6 billion, an increase of 4 percent year over year. The Company posted a quarterly earnings per diluted share of $2.18.',
    }),
  });

  console.log(`   HTTP Status: ${basicRes.status}`);
  if (basicRes.ok) {
    const data = await basicRes.json();
    console.log(`   Verdict: ${data.verdict}`);
    console.log(`   Confidence: ${data.confidence}`);
    console.log(`   Evidence: ${data.evidence?.slice(0, 100)}...`);
    console.log(`   Latency: ${data.meta?.latency_ms}ms`);
    console.log('   ✅ Basic verification PASSED\n');
  } else {
    const text = await basicRes.text();
    console.log(`   ❌ Failed: ${text.slice(0, 200)}\n`);
  }

  // 3. Check post-transaction balance
  console.log('3. Checking post-transaction balance...');
  const newBalance = await getWalletBalance();
  const spent = (parseFloat(balance.balanceUSDC) - parseFloat(newBalance.balanceUSDC)).toFixed(4);
  console.log(`   New Balance: ${newBalance.balanceUSDC} USDC`);
  console.log(`   Spent: $${spent} USDC\n`);

  console.log('=== E2E Test Complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
