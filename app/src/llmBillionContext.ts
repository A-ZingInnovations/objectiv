/** billion-context (`bili`) proxy — long-context BYOK routing. */

function trimBase(url: string): string {
  return url.replace(/\/$/, '');
}

export function billionContextProxyUrl(
  daemonUrl: string,
  upstreamOpenAiCompatibleBase: string,
): string {
  const daemon = trimBase(daemonUrl || 'http://127.0.0.1:8787');
  const upstream = trimBase(upstreamOpenAiCompatibleBase);
  return `${daemon}/bili/${upstream}`;
}

export function resolveByokBaseUrl(opts: {
  llmByokBaseUrl: string;
  biliContextEnabled: boolean;
  biliDaemonUrl: string;
}): string {
  const upstream = trimBase(opts.llmByokBaseUrl);
  if (!opts.biliContextEnabled) return upstream;
  return billionContextProxyUrl(opts.biliDaemonUrl, upstream);
}

/** When tracking is on, Ollama traffic also goes through bili for session persistence. */
export function resolveOllamaBaseUrl(opts: {
  ollamaBaseUrl: string;
  biliContextEnabled: boolean;
  biliDaemonUrl: string;
}): string {
  const upstream = trimBase(opts.ollamaBaseUrl);
  if (!opts.biliContextEnabled) return upstream;
  return billionContextProxyUrl(opts.biliDaemonUrl, upstream);
}