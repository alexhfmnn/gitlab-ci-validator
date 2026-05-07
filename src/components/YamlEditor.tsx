import { useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import type { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { githubLight, githubDark } from '@uiw/codemirror-theme-github';
import { EditorView } from '@codemirror/view';
import type { EditorTarget } from '../types';
import './YamlEditor.css';

interface Props {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly target: EditorTarget | null;
  readonly onTargetApplied: () => void;
}

export function YamlEditor({ value, onChange, target, onTargetApplied }: Props) {
  const ref = useRef<ReactCodeMirrorRef | null>(null);
  const isDark = useDarkMode();

  useEffect(() => {
    if (!target) return;
    const view = ref.current?.view;
    if (!view) return;
    const lineIndex = Math.max(1, Math.min(target.line, view.state.doc.lines));
    const lineInfo = view.state.doc.line(lineIndex);
    view.dispatch({
      selection: { anchor: lineInfo.from },
      scrollIntoView: true,
      effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
    });
    view.focus();
    onTargetApplied();
  }, [target, onTargetApplied]);

  return (
    <div className="yaml-editor">
      <CodeMirror
        ref={ref}
        value={value}
        height="500px"
        theme={isDark ? githubDark : githubLight}
        extensions={[yaml()]}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
        }}
        onChange={onChange}
      />
    </div>
  );
}

function useDarkMode(): boolean {
  return globalThis.window.matchMedia('(prefers-color-scheme: dark)').matches;
}
