/** VS Code–style Output panel text (task / shell logs). */

type Listener = () => void;

let text = '';
const listeners = new Set<Listener>();

export function getOutputText(): string {
  return text;
}

export function clearOutput(): void {
  text = '';
  listeners.forEach((fn) => fn());
}

export function appendOutput(chunk: string, source?: string): void {
  const prefix = source ? `[${source}] ` : '';
  const line = chunk.endsWith('\n') ? `${prefix}${chunk}` : `${prefix}${chunk}\n`;
  text += line;
  listeners.forEach((fn) => fn());
}

export function setOutput(next: string): void {
  text = next;
  listeners.forEach((fn) => fn());
}

export function subscribeOutput(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
