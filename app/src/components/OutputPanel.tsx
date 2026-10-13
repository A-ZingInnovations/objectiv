import { useEffect, useRef, useState } from 'react';
import { clearOutput, getOutputText, subscribeOutput } from '../outputChannel';

export default function OutputPanel() {
  const [text, setText] = useState(getOutputText);
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => subscribeOutput(() => setText(getOutputText())), []);

  useEffect(() => {
    preRef.current?.scrollTo(0, preRef.current.scrollHeight);
  }, [text]);

  return (
    <div className="output-panel">
      <div className="output-panel-toolbar">
        <button type="button" className="output-clear" onClick={() => clearOutput()}>
          Clear Output
        </button>
      </div>
      <pre ref={preRef} className="output-panel-text">
        {text || 'Output from Run tasks and workspace scripts appears here.'}
      </pre>
    </div>
  );
}
