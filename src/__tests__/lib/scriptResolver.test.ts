import { describe, expect, it } from 'vitest';
import { resolveScripts } from '../../lib/scriptResolver';

describe('resolveScripts', () => {
  it('uses the job-level scripts when present', () => {
    const r = resolveScripts(
      {
        before_script: ['echo before'],
        script: ['echo run', 'echo more'],
        after_script: 'echo after',
      },
      undefined,
    );
    expect(r.beforeScript).toEqual(['echo before']);
    expect(r.script).toEqual(['echo run', 'echo more']);
    expect(r.afterScript).toEqual(['echo after']);
  });

  it('falls back to default for before_script and after_script', () => {
    const r = resolveScripts(
      { script: 'do' },
      { before_script: ['setup'], after_script: ['cleanup'] },
    );
    expect(r.beforeScript).toEqual(['setup']);
    expect(r.afterScript).toEqual(['cleanup']);
    expect(r.script).toEqual(['do']);
  });

  it('does NOT inherit script: from default (script is job-level only)', () => {
    const r = resolveScripts({}, { script: ['nope'] });
    expect(r.script).toEqual([]);
  });

  it('flattens one level of nested string arrays', () => {
    const r = resolveScripts({ script: [['echo a', 'echo b'], 'echo c'] }, undefined);
    expect(r.script).toEqual(['echo a', 'echo b', 'echo c']);
  });

  it('returns empty arrays when nothing provided', () => {
    expect(resolveScripts({}, undefined)).toEqual({
      beforeScript: [],
      script: [],
      afterScript: [],
    });
  });

  it('drops non-string non-array entries inside the array', () => {
    expect(resolveScripts({ script: ['ok', 42, null] }, undefined).script).toEqual(['ok']);
  });

  it('returns [] for a script that is neither string nor array (e.g. number)', () => {
    expect(resolveScripts({ script: 42 }, undefined).script).toEqual([]);
  });
});
