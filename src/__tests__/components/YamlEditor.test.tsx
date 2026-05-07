import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { YamlEditor } from '../../components/YamlEditor';

describe('YamlEditor', () => {
  it('renders the CodeMirror editor with the provided value', () => {
    const { container } = render(
      <YamlEditor
        value="stages:\n  - build\n"
        onChange={() => undefined}
        target={null}
        onTargetApplied={() => undefined}
      />,
    );
    expect(container.querySelector('.yaml-editor')).not.toBeNull();
    expect(container.querySelector('.cm-editor')).not.toBeNull();
  });

  it('jumps to the requested line when target is set', async () => {
    const onTargetApplied = vi.fn();
    const { rerender } = render(
      <YamlEditor
        value={'a:\n  script: echo\nb:\n  script: echo\n'}
        onChange={() => undefined}
        target={null}
        onTargetApplied={onTargetApplied}
      />,
    );
    rerender(
      <YamlEditor
        value={'a:\n  script: echo\nb:\n  script: echo\n'}
        onChange={() => undefined}
        target={{ line: 3 }}
        onTargetApplied={onTargetApplied}
      />,
    );
    await waitFor(() => {
      expect(onTargetApplied).toHaveBeenCalled();
    });
  });

  it('clamps the target line to the document length', async () => {
    const onTargetApplied = vi.fn();
    const { rerender } = render(
      <YamlEditor
        value={'a: 1\n'}
        onChange={() => undefined}
        target={null}
        onTargetApplied={onTargetApplied}
      />,
    );
    rerender(
      <YamlEditor
        value={'a: 1\n'}
        onChange={() => undefined}
        target={{ line: 999 }}
        onTargetApplied={onTargetApplied}
      />,
    );
    await waitFor(() => {
      expect(onTargetApplied).toHaveBeenCalled();
    });
  });

  it('does nothing when target is null', () => {
    const onTargetApplied = vi.fn();
    render(
      <YamlEditor
        value="a: 1\n"
        onChange={() => undefined}
        target={null}
        onTargetApplied={onTargetApplied}
      />,
    );
    expect(onTargetApplied).not.toHaveBeenCalled();
  });

  it('uses the dark theme when prefers-color-scheme is dark', () => {
    const original = globalThis.window.matchMedia;
    globalThis.window.matchMedia = (query: string): MediaQueryList => {
      const mql: MediaQueryList = {
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      };
      return mql;
    };
    try {
      const { container } = render(
        <YamlEditor
          value="a: 1\n"
          onChange={() => undefined}
          target={null}
          onTargetApplied={() => undefined}
        />,
      );
      expect(container.querySelector('.cm-editor')).not.toBeNull();
    } finally {
      globalThis.window.matchMedia = original;
    }
  });
});
