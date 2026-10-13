export const INITIAL_FILES: Record<string, string> = {
  'README.md': `# Objectiv (AZO)

Welcome to **Objectiv** — A-Zing's Objectiv developer portal and IDE shell.

## Viewers

- Markdown: Edit / Split / Preview
- PDF, Word (\`.docx\`), Excel (\`.xlsx\` / \`.xls\`)

Open a folder and click a document in the Explorer.
`,
  'src/App.tsx': `export default function App() {
  return (
    <div>
      <h1>Objectiv</h1>
      <p>Describe a task in the chat — the agent will build it.</p>
    </div>
  );
}
`,
  'src/index.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
  'package.json': `{
  "name": "my-app",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
`,
};

const EXT_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  vue: 'html',
  md: 'markdown',
  mdx: 'markdown',
  py: 'python',
  pyi: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  sql: 'sql',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  xml: 'xml',
  dockerfile: 'dockerfile',
  graphql: 'graphql',
  gql: 'graphql',
};

export function pathToLanguage(path: string): string {
  const base = path.split('/').pop() ?? path;
  const lower = base.toLowerCase();
  if (
    lower === 'dockerfile' ||
    lower.startsWith('dockerfile.') ||
    lower.endsWith('.dockerfile')
  ) {
    return 'dockerfile';
  }
  if (lower === 'makefile') return 'makefile';
  if (
    lower === 'compose.yml' ||
    lower === 'compose.yaml' ||
    lower === 'docker-compose.yml' ||
    lower === 'docker-compose.yaml' ||
    /^docker-compose\..+\.ya?ml$/.test(lower) ||
    /^compose\..+\.ya?ml$/.test(lower)
  ) {
    return 'yaml';
  }
  const dot = lower.lastIndexOf('.');
  if (dot >= 0) {
    const ext = lower.slice(dot + 1);
    if (EXT_LANG[ext]) return EXT_LANG[ext];
  }
  return 'plaintext';
}
