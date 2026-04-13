/**
 * Verification Engine — Core logic for Hallucination Gate
 * 
 * Supports multiple LLM backends:
 *   1. Google Gemini (GEMINI_API_KEY) — free tier, 15 RPM
 *   2. OpenRouter (OPENROUTER_API_KEY) — pay-as-you-go, 300+ models
 *   3. OpenAI-compatible (OPENAI_API_KEY + OPENAI_BASE_URL)
 * 
 * Falls back in order: Gemini → OpenRouter → OpenAI
 */

// --- Retry with Exponential Backoff ---

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callWithRetry(fn, maxRetries = 5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('503') || err.message?.includes('UNAVAILABLE') || err.message?.includes('overloaded');
      if (isRetryable && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 30000);
        console.log(`[retry] Rate limited (attempt ${attempt + 1}/${maxRetries}), waiting ${Math.round(delay)}ms...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

// --- LLM Backend ---

async function callLLM(prompt, temperature = 0.1) {
  // Try Gemini first (free) with retry for rate limits
  if (process.env.GEMINI_API_KEY) {
    try {
      return await callWithRetry(() => callGemini(prompt, temperature));
    } catch (err) {
      console.warn(`[callLLM] Gemini failed: ${err.message}`);
      // Fall through to next backend
    }
  }
  // Then OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    return await callOpenRouter(prompt, temperature);
  }
  // Then OpenAI-compatible
  if (process.env.OPENAI_API_KEY) {
    return await callOpenAI(prompt, temperature);
  }
  throw new Error('No LLM API key configured or all backends failed.');
}

async function callGemini(prompt, temperature) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return parseJSON(text);
}

async function callOpenRouter(prompt, temperature) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://hallucination-gate.com',
      'X-Title': 'Hallucination Gate',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      response_format: { type: 'json_object' },
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  return parseJSON(text);
}

async function callOpenAI(prompt, temperature) {
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-nano',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      response_format: { type: 'json_object' },
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  return parseJSON(text);
}

function parseJSON(text) {
  if (!text) throw new Error('Empty LLM response');
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Failed to parse LLM response as JSON');
  }
}

// --- Verification Functions ---

export async function verifyClaim(claim, source, context = '') {
  const contextBlock = context ? `\nAdditional context: ${context}` : '';

  const prompt = `You are a rigorous fact-checking system. Determine whether a CLAIM is supported by the SOURCE material.

CLAIM: "${claim}"
${contextBlock}
SOURCE:
"""
${source.slice(0, 30000)}
"""

Analyze carefully. Return JSON with exactly these fields:

{
  "verdict": "supported" | "unsupported" | "contradicted" | "unverifiable",
  "confidence": <number 0.0 to 1.0>,
  "evidence": "<specific passage from the source supporting your verdict>",
  "summary": "<one sentence explaining the verdict>"
}

Definitions:
- "supported": Source directly supports the claim with evidence
- "contradicted": Source contains information that directly contradicts the claim
- "unsupported": Source lacks enough information to verify, but doesn't contradict
- "unverifiable": Claim is about something the source doesn't address at all

Be precise. Quote the source directly in evidence. Check numbers carefully.`;

  return await callLLM(prompt);
}

export async function verifyClaimDeep(claim, source, context = '') {
  const contextBlock = context ? `\nAdditional context: ${context}` : '';

  // Pass 1: Decompose into atomic sub-claims
  const decompose = await callLLM(`Break this claim into individual factual assertions.

CLAIM: "${claim}"

Return JSON: { "subclaims": ["subclaim1", "subclaim2", ...] }
Each should be a single, independently verifiable assertion. If already atomic, return single-element array.`);

  const subclaims = decompose.subclaims || [claim];

  // Pass 2: Verify each sub-claim (with delay between calls to respect rate limits)
  const subResults = [];
  for (let i = 0; i < Math.min(subclaims.length, 5); i++) {
    if (i > 0) await sleep(2000); // 2s gap between calls to stay under 5 RPM
    const sc = subclaims[i];
    const result = await callLLM(`Verify this claim against the source.

CLAIM: "${sc}"
${contextBlock}
SOURCE:
"""
${source.slice(0, 25000)}
"""

Return JSON:
{
  "subclaim": "${sc}",
  "verdict": "supported" | "unsupported" | "contradicted" | "unverifiable",
  "confidence": <0.0-1.0>,
  "evidence": "<quoted passage from source>"
}`);
    subResults.push(result);
  }

  // Pass 3: Synthesize overall verdict
  await sleep(2000); // rate limit buffer
  const synthesis = await callLLM(`Given sub-claim results, produce an overall verdict.

ORIGINAL CLAIM: "${claim}"

SUB-CLAIM RESULTS:
${JSON.stringify(subResults, null, 2)}

Return JSON:
{
  "verdict": "supported" | "unsupported" | "contradicted" | "unverifiable",
  "confidence": <0.0-1.0>,
  "evidence": "<key evidence summary>",
  "reasoning": "<step-by-step reasoning chain>",
  "flags": ["<issues, contradictions, or caveats>"],
  "subclaim_results": <the sub-claim results array>,
  "summary": "<one sentence overall assessment>"
}

Rules:
- If ANY subclaim is contradicted, overall should be contradicted unless minor
- Confidence reflects the weakest link
- Flag: numerical mismatches, missing context, ambiguous language, temporal issues`);

  return synthesis;
}
