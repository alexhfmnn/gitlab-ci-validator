import { describe, expect, it } from 'vitest';
import { normalizePipeline, normalizePipelineToObject } from '../../lib/normalizePipeline';

describe('normalizePipeline', () => {
  it('flattens one level of nested arrays in job rules', () => {
    const out = normalizePipeline({
      myjob: {
        script: 'echo',
        rules: [[{ if: '$A' }], [{ if: '$B' }, { if: '$C' }], { if: '$D' }],
      },
    }) as Record<string, Record<string, unknown>>;
    expect(out['myjob']?.['rules']).toEqual([
      { if: '$A' },
      { if: '$B' },
      { if: '$C' },
      { if: '$D' },
    ]);
  });

  it('flattens nested arrays in workflow rules', () => {
    const out = normalizePipeline({
      workflow: { rules: [[{ if: '$A' }], { if: '$B' }] },
    }) as Record<string, { rules: unknown[] }>;
    expect(out['workflow']?.rules).toEqual([{ if: '$A' }, { if: '$B' }]);
  });

  it('leaves reserved top-level keys untouched as jobs', () => {
    const out = normalizePipeline({
      stages: ['build'],
      variables: { FOO: 'bar' },
      myjob: { script: 'echo', rules: [{ if: '$A' }] },
    }) as Record<string, unknown>;
    expect(out['stages']).toEqual(['build']);
    expect(out['variables']).toEqual({ FOO: 'bar' });
  });

  it('returns the input unchanged for non-object roots', () => {
    expect(normalizePipeline('scalar')).toBe('scalar');
    expect(normalizePipeline(null)).toBeNull();
    expect(normalizePipeline([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('does not mutate jobs without rules', () => {
    const out = normalizePipeline({ a: { script: 'echo' } }) as Record<string, unknown>;
    expect(out['a']).toEqual({ script: 'echo' });
  });

  it('skips workflow that has no rules array', () => {
    const out = normalizePipeline({ workflow: { name: 'pipeline' } }) as Record<string, unknown>;
    expect(out['workflow']).toEqual({ name: 'pipeline' });
  });

  it('leaves non-object job entries untouched (e.g. scalar)', () => {
    const out = normalizePipeline({ scalar_job: 42, real: { script: 'echo' } }) as Record<
      string,
      unknown
    >;
    expect(out['scalar_job']).toBe(42);
    expect(out['real']).toEqual({ script: 'echo' });
  });
});

describe('normalizePipelineToObject', () => {
  it('returns null for non-object inputs', () => {
    expect(normalizePipelineToObject('scalar')).toBeNull();
    expect(normalizePipelineToObject(null)).toBeNull();
    expect(normalizePipelineToObject([1, 2, 3])).toBeNull();
  });

  it('returns the normalized object for plain objects', () => {
    const out = normalizePipelineToObject({ a: { script: 'echo' } });
    expect(out).toEqual({ a: { script: 'echo' } });
  });
});
