# Objectiv LLM Suite — session backlog (GitHub)

Tracks multi-turn product requests so nothing is dropped between sessions.

## Active (Nov 2026)

| # | Request | Status |
|---|---------|--------|
| 1 | OpenRouter BYOK + LLM Suite **performance test** UI | Done — Providers preset, playground **Run performance test** |
| 2 | JSON **prettify on open** + Settings toggle | Done — `formatJsonOnOpen` |
| 3 | XML open — root / tree / stats in editor pane | Done — `XmlTextViewer` + `xmlShowStructurePanel` |
| 4 | LLM **inline code completion** | Done — `llmInlineCompletions` (LLM Suite model) |
| 5 | Instant error detection + **LLM quick fixes** | Done — client validation + `llmInstantDiagnostics` + `llmInstantFixes` |
| 6 | **billion-context** (`bili`) request tracking (opt-in) | Done — toggle, Ollama+BYOK via proxy, central ingest |

### billion-context / request tracking

- **Toggle:** Settings → LLM Suite → **Track LLM Suite requests (bili)** (default off).
- **Local daemon:** `bash objectiv/scripts/objectiv-bili.sh` or `bili start` → **http://127.0.0.1:8787**
- **Traffic:** When on, **Ollama and BYOK** call `http://127.0.0.1:8787/bili/<upstream>` so sessions persist on device.
- **Central ingest (optional):** `biliIngestUrl` → unified-agent `POST /v1/bili/events` (JSONL + S3). Build with `VITE_OBJECTIV_BILI_INGEST_URL`.

### OpenRouter perf test (manual)

1. **Settings → LLM Suite → Providers** → OpenRouter → paste API key (never commit keys)
2. **Use OpenRouter preset** or pick a model
3. **Playground → Run performance test** (models list + latency probes)

## Prior session (done)

- LLM Suite panel, Ollama pull, voice STT/TTS, cross-pane tab DnD, editor split-by-drag
- Settings v2 schema, Testing panel, Explorer folder remove

## Follow-ups

- Narrower LLM quick-fix edits (line-range, not full file)
- Debounce / cancel inline completions; local Ollama default for completions to reduce cost
- Automated perf test export to file / CI script
- Deeper XML: XPath query, namespace table