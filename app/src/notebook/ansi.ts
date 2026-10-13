/** Minimal ANSI SGR → safe HTML for notebook / terminal previews. */

const ANSI_COLORS: Record<number, string> = {
  30: '#000000',
  31: '#cd3131',
  32: '#0dbc79',
  33: '#e5e510',
  34: '#2472c8',
  35: '#bc3fbc',
  36: '#11a8cd',
  37: '#e5e5e5',
  39: '',
  90: '#666666',
  91: '#f14c4c',
  92: '#23d18b',
  93: '#f5f543',
  94: '#3b8eea',
  95: '#d670d6',
  96: '#29b8db',
  97: '#e5e5e5',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert text with ANSI escapes to HTML spans. Always escapes content. */
export function ansiToHtml(raw: string): string {
  if (!raw) return '';
  // Normalize common Jupyter CSI variants
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!/\x1b\[|\x1b\]/.test(text)) {
    return escapeHtml(text);
  }

  let html = '';
  let open = false;
  let style = '';
  const re = /\x1b\[([0-9;]*)m/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    html += escapeHtml(text.slice(last, m.index));
    last = m.index + m[0].length;
    const codes = (m[1] || '0').split(';').map((c) => parseInt(c || '0', 10));
    let color = '';
    let bold = false;
    let dim = false;
    for (const code of codes) {
      if (code === 0) {
        color = '';
        bold = false;
        dim = false;
      } else if (code === 1) bold = true;
      else if (code === 2) dim = true;
      else if (code === 22) {
        bold = false;
        dim = false;
      } else if (ANSI_COLORS[code] !== undefined) {
        color = ANSI_COLORS[code];
      }
    }
    if (open) {
      html += '</span>';
      open = false;
    }
    const parts: string[] = [];
    if (color) parts.push(`color:${color}`);
    if (bold) parts.push('font-weight:700');
    if (dim) parts.push('opacity:0.7');
    style = parts.join(';');
    if (style) {
      html += `<span style="${style}">`;
      open = true;
    }
  }
  html += escapeHtml(text.slice(last));
  if (open) html += '</span>';
  // Drop OSC / other CSI we don't handle
  return html.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
}

export function stripAnsi(raw: string): string {
  return raw
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
}
