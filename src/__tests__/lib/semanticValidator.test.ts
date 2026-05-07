import { describe, expect, it } from 'vitest';
import { findKeyLineUnderTopLevel, validateSemantics } from '../../lib/semanticValidator';

describe('validateSemantics — stage existence', () => {
  it('flags a job whose stage is not declared', () => {
    const yamlText = [
      'stages:',
      '  - build',
      '  - test',
      'broken:',
      '  stage: mok',
      '  script: echo',
    ].join('\n');
    const errors = validateSemantics(
      { stages: ['build', 'test'], broken: { stage: 'mok', script: 'echo' } },
      yamlText,
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain('broken job: chosen stage mok does not exist');
    expect(errors[0]?.message).toContain('.pre');
    expect(errors[0]?.message).toContain('.post');
    expect(errors[0]?.line).toBe(5);
  });

  it('accepts .pre and .post stages', () => {
    expect(
      validateSemantics(
        {
          stages: ['build'],
          a: { stage: '.pre', script: 'echo' },
          b: { stage: '.post', script: 'echo' },
        },
        '',
      ),
    ).toEqual([]);
  });

  it('uses default stages when none declared', () => {
    const errors = validateSemantics(
      { good: { stage: 'test', script: 'echo' }, bad: { stage: 'wat', script: 'echo' } },
      '',
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain('bad job');
  });

  it('skips hidden jobs (.template)', () => {
    expect(validateSemantics({ '.template': { stage: 'wat', script: 'echo' } }, '')).toEqual([]);
  });

  it('skips reserved top-level keys', () => {
    expect(validateSemantics({ workflow: { rules: [] }, variables: { K: 'v' } }, '')).toEqual([]);
  });
});

describe('findKeyLineUnderTopLevel', () => {
  const yamlText = ['job1:', '  stage: build', '  script: echo', 'job2:', '  stage: test'].join(
    '\n',
  );

  it('returns the line of the sub-key under the matching top-level key', () => {
    expect(findKeyLineUnderTopLevel('job1', 'stage', yamlText)).toBe(2);
    expect(findKeyLineUnderTopLevel('job2', 'stage', yamlText)).toBe(5);
  });

  it('returns undefined if the top-level key does not exist', () => {
    expect(findKeyLineUnderTopLevel('missing', 'stage', yamlText)).toBeUndefined();
  });

  it('returns undefined if the sub-key is not found before the next top-level key', () => {
    expect(findKeyLineUnderTopLevel('job1', 'missing', yamlText)).toBeUndefined();
  });

  it('skips blank lines while scanning sub-keys', () => {
    const yamlText = ['job1:', '', '  stage: build', 'job2:', '  stage: test'].join('\n');
    expect(findKeyLineUnderTopLevel('job1', 'stage', yamlText)).toBe(3);
  });
});

describe('validateSemantics — non-object job entries', () => {
  it('skips entries where the value is not a plain object (scalar)', () => {
    const input: Record<string, unknown> = { scalar_job: 42 };
    expect(validateSemantics(input, '')).toEqual([]);
  });

  it('skips jobs whose stage is not a string', () => {
    const input: Record<string, unknown> = { a: { stage: 42, script: 'echo' } };
    expect(validateSemantics(input, '')).toEqual([]);
  });
});
