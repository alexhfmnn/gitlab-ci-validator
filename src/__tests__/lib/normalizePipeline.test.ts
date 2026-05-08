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

  it('flattens nested arrays in job cache (multiple cache entries)', () => {
    const out = normalizePipeline({
      myjob: {
        script: 'echo',
        cache: [
          [{ key: 'gradle-global', paths: ['$CI_PROJECT_DIR/.gradle/'] }],
          [{ key: 'npm-global', paths: ['$CI_PROJECT_DIR/.npm/'] }],
        ],
      },
    }) as Record<string, Record<string, unknown>>;
    expect(out['myjob']?.['cache']).toEqual([
      { key: 'gradle-global', paths: ['$CI_PROJECT_DIR/.gradle/'] },
      { key: 'npm-global', paths: ['$CI_PROJECT_DIR/.npm/'] },
    ]);
  });

  it('flattens nested arrays in job services, needs, tags, dependencies, extends', () => {
    const out = normalizePipeline({
      myjob: {
        script: 'echo',
        services: [['postgres:14'], ['redis:7']],
        needs: [[{ job: 'build' }], [{ job: 'lint' }]],
        tags: [['fcn'], ['linux']],
        dependencies: [['build'], ['compile']],
        extends: [['.shared'], ['.gradle']],
      },
    }) as Record<string, Record<string, unknown>>;
    const job = out['myjob'] ?? {};
    expect(job['services']).toEqual(['postgres:14', 'redis:7']);
    expect(job['needs']).toEqual([{ job: 'build' }, { job: 'lint' }]);
    expect(job['tags']).toEqual(['fcn', 'linux']);
    expect(job['dependencies']).toEqual(['build', 'compile']);
    expect(job['extends']).toEqual(['.shared', '.gradle']);
  });

  it('flattens nested arrays in top-level include, cache, services', () => {
    const out = normalizePipeline({
      include: [[{ local: 'a.yml' }], [{ local: 'b.yml' }, { local: 'c.yml' }], { local: 'd.yml' }],
      cache: [[{ key: 'x', paths: ['p'] }]],
      services: [['postgres'], 'redis'],
    }) as Record<string, unknown>;
    expect(out['include']).toEqual([
      { local: 'a.yml' },
      { local: 'b.yml' },
      { local: 'c.yml' },
      { local: 'd.yml' },
    ]);
    expect(out['cache']).toEqual([{ key: 'x', paths: ['p'] }]);
    expect(out['services']).toEqual(['postgres', 'redis']);
  });

  it('flattens nested arrays in default block (cache, services, tags)', () => {
    const out = normalizePipeline({
      default: {
        cache: [[{ key: 'g' }], [{ key: 'n' }]],
        services: [['postgres'], ['redis']],
        tags: [['fcn'], ['linux']],
      },
    }) as Record<string, Record<string, unknown>>;
    const def = out['default'] ?? {};
    expect(def['cache']).toEqual([{ key: 'g' }, { key: 'n' }]);
    expect(def['services']).toEqual(['postgres', 'redis']);
    expect(def['tags']).toEqual(['fcn', 'linux']);
  });

  it('leaves non-array values in flattenable keys untouched', () => {
    const out = normalizePipeline({
      myjob: {
        script: 'echo',
        cache: { key: 'single', paths: ['p'] },
        extends: '.base',
      },
    }) as Record<string, Record<string, unknown>>;
    const job = out['myjob'] ?? {};
    expect(job['cache']).toEqual({ key: 'single', paths: ['p'] });
    expect(job['extends']).toBe('.base');
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
