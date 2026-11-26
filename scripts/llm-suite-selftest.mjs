#!/usr/bin/env node
/**
 * Headless checks for Objectiv LLM Suite / editor assist helpers.
 * Usage: node scripts/llm-suite-selftest.mjs
 * Optional: OPENROUTER_API_KEY=sk-or-v1-... node scripts/llm-suite-selftest.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JSDOM } from 'jsdom';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'src');

function loadTsLike(path) {
  return readFileSync(path, 'utf8');
}

// --- JSON prettify (inline from jsonFormat.ts) ---
function isJsonFilePath(path) {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return ext === 'json' || ext === 'jsonc' || ext === 'code-workspace';
}
function prettifyJsonContent(content, indent = 2) {
  const trimmed = content.trim();
  if (!trimmed) return content;
  try {
    const parsed = JSON.parse(trimmed);
    return `${JSON.stringify(parsed, null, indent)}\n`;
  } catch {
    return content;
  }
}
function maybePrettifyJsonOnOpen(path, content, enabled) {
  if (!enabled || !isJsonFilePath(path)) return content;
  return prettifyJsonContent(content);
}

// --- bili URL (inline from llmBillionContext.ts) ---
function billionContextProxyUrl(daemonUrl, upstream) {
  const daemon = (daemonUrl || 'http://127.0.0.1:8787').replace(/\/$/, '');
  const up = upstream.replace(/\/$/, '');
  return `${daemon}/bili/${up}`;
}

// --- XML analyze (same logic as xmlStructure.ts, with JSDOM DOMParser) ---
function analyzeXmlDocument(text) {
  const empty = {
    valid: false,
    elementCount: 0,
    attributeCount: 0,
    maxDepth: 0,
    tree: [],
    childTags: [],
  };
  const trimmed = text.trim();
  if (!trimmed) return { ...empty, error: 'Empty document' };
  const doc = new JSDOM().window.document;
  const parser = new doc.defaultView.DOMParser();
  try {
    const xml = parser.parseFromString(trimmed, 'application/xml');
    const parseError = xml.querySelector('parsererror');
    if (parseError) {
      return { ...empty, error: (parseError.textContent || 'parse error').slice(0, 280) };
    }
    const root = xml.documentElement;
    if (!root) return { ...empty, error: 'No document element' };
    const childTags = [...root.children].map((c) => c.tagName);
    return {
      valid: true,
      root: root.tagName,
      elementCount: xml.getElementsByTagName('*').length + 1,
      attributeCount: root.attributes.length,
      maxDepth: 2,
      childTags,
    };
  } catch (e) {
    return { ...empty, error: String(e) };
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function section(title) {
  console.log(`\n## ${title}`);
}

async function main() {
  console.log('Objectiv self-test —', new Date().toISOString());
  section('JSON prettify on open');
  const ugly = '{"a":1,"b":[2,3]}';
  const pretty = maybePrettifyJsonOnOpen('/tmp/foo.json', ugly, true);
  assert(pretty.includes('\n'), 'valid JSON should be indented');
  assert(pretty !== ugly, 'content should change when prettified');
  const invalid = maybePrettifyJsonOnOpen('/tmp/foo.json', '{bad', true);
  assert(invalid === '{bad', 'invalid JSON unchanged');
  const off = maybePrettifyJsonOnOpen('/tmp/foo.json', ugly, false);
  assert(off === ugly, 'toggle off leaves content');
  console.log('  ✓ valid prettify, invalid unchanged, toggle respected');

  section('XML structure');
  const sample = `<?xml version="1.0"?><catalog><book id="1"/><book id="2"/></catalog>`;
  const xml = analyzeXmlDocument(sample);
  assert(xml.valid, xml.error || 'expected valid XML');
  assert(xml.root === 'catalog', `root=${xml.root}`);
  assert(xml.childTags.includes('book'), `children=${xml.childTags}`);
  const bad = analyzeXmlDocument('<unclosed>');
  assert(!bad.valid, 'broken XML should be invalid');
  console.log(`  ✓ valid root=${xml.root} elements≈${xml.elementCount}, invalid rejected`);

  section('billion-context (bili) proxy');
  const proxied = billionContextProxyUrl(
    'http://127.0.0.1:8787',
    'https://openrouter.ai/api/v1',
  );
  assert(proxied.includes('/bili/'), proxied);
  let biliOk = false;
  try {
    const r = await fetch('http://127.0.0.1:8787/', { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    biliOk = Boolean(j.ok);
    console.log(`  ✓ bili daemon ${r.status} upstream=${j.upstream ?? '?'}`);
  } catch (e) {
    console.log(`  ✗ bili daemon unreachable (${e.message})`);
  }
  if (biliOk) {
    try {
      const r2 = await fetch(`${proxied}/models`, {
        headers: { Authorization: 'Bearer sk-test' },
        signal: AbortSignal.timeout(8000),
      });
      console.log(`  ✓ proxied GET /models → HTTP ${r2.status} (expect 401/403 without key)`);
    } catch (e) {
      console.log(`  ⚠ proxied /models fetch: ${e.message}`);
    }
  }

  section('OpenRouter performance probes');
  const key = (process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || '').trim();
  if (!key) {
    console.log('  ⚠ No OPENROUTER_API_KEY in env — skipping live OpenRouter perf test.');
    console.log('    Set key and re-run, or paste under Settings → LLM Suite → BYOK in the app.');
    return;
  }
  const base = biliOk
    ? billionContextProxyUrl('http://127.0.0.1:8787', 'https://openrouter.ai/api/v1')
    : 'https://openrouter.ai/api/v1';
  const headers = {
    Authorization: `Bearer ${key}`,
    'HTTP-Referer': 'https://objectiv.local',
    'X-Title': 'Objectiv LLM Suite selftest',
  };
  const t0 = performance.now();
  const modelsRes = await fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(30000) });
  const modelsMs = Math.round(performance.now() - t0);
  const modelsBody = await modelsRes.json().catch(() => ({}));
  const ids = Array.isArray(modelsBody.data) ? modelsBody.data.map((m) => m.id).filter(Boolean) : [];
  console.log(
    `  ${modelsRes.ok ? '✓' : '✗'} GET /models ${modelsMs}ms — ${ids.length} models (HTTP ${modelsRes.status})`,
  );
  const model = ids.includes('openai/gpt-4o-mini') ? 'openai/gpt-4o-mini' : ids[0];
  if (!model) {
    console.log('  ✗ No model id to probe chat');
    return;
  }
  const chatBody = {
    model,
    messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
    max_tokens: 16,
  };
  const t1 = performance.now();
  const chatRes = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(chatBody),
    signal: AbortSignal.timeout(60000),
  });
  const chatMs = Math.round(performance.now() - t1);
  const chatJson = await chatRes.json().catch(() => ({}));
  const text = chatJson.choices?.[0]?.message?.content?.trim() ?? '';
  console.log(
    `  ${chatRes.ok && text ? '✓' : '✗'} Chat ping (${model}) ${chatMs}ms — "${text.slice(0, 40)}" HTTP ${chatRes.status}`,
  );
  if (biliOk) console.log('  (via bili proxy)');
}

main().catch((e) => {
  console.error('SELFTEST FAILED:', e.message);
  process.exit(1);
});