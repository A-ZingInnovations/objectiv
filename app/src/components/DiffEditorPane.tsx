import { DiffEditor } from '@monaco-editor/react';

type Props = {
  path: string;
  language: string;
  original: string;
  modified: string;
  fontSize?: number;
  theme?: 'vs-dark' | 'vs';
};

export default function DiffEditorPane({
  path,
  language,
  original,
  modified,
  fontSize = 14,
  theme = 'vs-dark',
}: Props) {
  return (
    <DiffEditor
      key={path}
      height="100%"
      language={language}
      theme={theme}
      original={original}
      modified={modified}
      options={{
        readOnly: true,
        renderSideBySide: true,
        fontSize,
        minimap: { enabled: false },
      }}
    />
  );
}
