import { describe, expect, it } from 'vitest';
import { simulate } from '../../lib/simulator';
import type { TriggerInputs } from '../../types';

const inputs: TriggerInputs = { defaultBranch: 'main', branchName: 'main' };

describe('simulate — workflow gate', () => {
  it('returns pipeline_blocked when workflow:rules has matching when:never', () => {
    const result = simulate(
      {
        workflow: { rules: [{ if: '$CI_COMMIT_BRANCH == "main"', when: 'never' }] },
        a: { stage: 'test', script: 'echo' },
      },
      'push',
      inputs,
      [],
    );
    expect(result.status).toBe('pipeline_blocked');
  });
});

describe('simulate — job filtering and stage ordering', () => {
  it('orders jobs by declared stage and preserves insertion within stage', () => {
    const result = simulate(
      {
        stages: ['build', 'test', 'deploy'],
        deploy_a: { stage: 'deploy', script: 'echo' },
        build_a: { stage: 'build', script: 'echo' },
        test_a: { stage: 'test', script: 'echo' },
        test_b: { stage: 'test', script: 'echo' },
      },
      'push',
      inputs,
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.jobs.map((j) => j.name)).toEqual(['build_a', 'test_a', 'test_b', 'deploy_a']);
  });

  it('uses the test stage as fallback when stage is omitted', () => {
    const result = simulate({ a: { script: 'echo' } }, 'push', inputs, []);
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.jobs[0]?.stage).toBe('test');
  });

  it('skips non-object job entries (scalar values)', () => {
    const result = simulate(
      { stages: ['test'], scalar_thing: 'oops', real: { stage: 'test', script: 'echo' } },
      'push',
      inputs,
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.jobs.map((j) => j.name)).toEqual(['real']);
  });

  it('skips hidden (.template) jobs and reserved keys', () => {
    const result = simulate(
      {
        stages: ['test'],
        '.template': { stage: 'test', script: 'echo' },
        variables: { X: '1' },
        real: { stage: 'test', script: 'echo' },
      },
      'push',
      inputs,
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.jobs.map((j) => j.name)).toEqual(['real']);
  });

  it('filters jobs whose rules do not match', () => {
    const result = simulate(
      {
        a: { script: 'echo', rules: [{ if: '$CI_COMMIT_BRANCH == "feature"' }] },
        b: { script: 'echo', rules: [{ if: '$CI_COMMIT_BRANCH == "main"' }] },
      },
      'push',
      inputs,
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.jobs.map((j) => j.name)).toEqual(['b']);
  });
});

describe('simulate — needs validation', () => {
  it('reports missing dependency', () => {
    const result = simulate(
      {
        a: { stage: 'test', script: 'echo', rules: [{ if: '$CI_COMMIT_BRANCH == "feature"' }] },
        b: { stage: 'test', script: 'echo', needs: ['a'] },
      },
      'push',
      inputs,
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.needsErrors).toEqual([{ job: 'b', missingDependency: 'a' }]);
  });

  it('does not report optional missing dependency', () => {
    const result = simulate(
      {
        a: { stage: 'test', script: 'echo', rules: [{ if: '$CI_COMMIT_BRANCH == "feature"' }] },
        b: { stage: 'test', script: 'echo', needs: [{ job: 'a', optional: true }] },
      },
      'push',
      inputs,
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.needsErrors).toEqual([]);
  });

  it('does not report when dependency is included', () => {
    const result = simulate(
      {
        a: { stage: 'test', script: 'echo' },
        b: { stage: 'test', script: 'echo', needs: ['a'] },
      },
      'push',
      inputs,
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.needsErrors).toEqual([]);
  });
});

describe('simulate — includeDetected', () => {
  it('marks includeDetected when an include: key is present', () => {
    const result = simulate({ include: 'other.yml', a: { script: 'echo' } }, 'push', inputs, []);
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.includeDetected).toBe(true);
  });
});

describe('simulate — sort fallback for unknown stage', () => {
  it('places jobs with stage not in declared stages at the end', () => {
    const result = simulate(
      {
        stages: ['build'],
        a: { stage: 'build', script: 'echo' },
        b: { stage: 'unknown_stage', script: 'echo' },
      },
      'push',
      inputs,
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.jobs.map((j) => j.name)).toEqual(['a', 'b']);
  });

  it('uses the first declared stage when stages omits "test"', () => {
    const result = simulate({ stages: ['only_one'], a: { script: 'echo' } }, 'push', inputs, []);
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.jobs[0]?.stage).toBe('only_one');
  });

  it('falls back to "test" string when stages array is empty', () => {
    const result = simulate({ stages: [], a: { script: 'echo' } }, 'push', inputs, []);
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.jobs[0]?.stage).toBe('test');
  });
});

describe('simulate — needs edge cases', () => {
  it('skips needs entries that are neither string nor object', () => {
    const result = simulate(
      {
        a: { stage: 'test', script: 'echo' },
        b: { stage: 'test', script: 'echo', needs: [42, null, ['x']] },
      },
      'push',
      inputs,
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.needsErrors).toEqual([]);
  });

  it('skips object needs without a string job key', () => {
    const result = simulate(
      {
        a: { stage: 'test', script: 'echo' },
        b: { stage: 'test', script: 'echo', needs: [{ pipeline: 'other' }] },
      },
      'push',
      inputs,
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.needsErrors).toEqual([]);
  });

  it('reports object needs with non-true optional as missing', () => {
    const result = simulate(
      {
        a: { stage: 'test', script: 'echo', rules: [{ if: '$CI_COMMIT_BRANCH == "feature"' }] },
        b: { stage: 'test', script: 'echo', needs: [{ job: 'a' }] },
      },
      'push',
      inputs,
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.needsErrors).toEqual([{ job: 'b', missingDependency: 'a' }]);
  });
});

describe('simulate — tags', () => {
  it('resolves tags from job, falling back to default', () => {
    const result = simulate(
      {
        default: { tags: ['shared'] },
        a: { script: 'echo' },
        b: { script: 'echo', tags: ['custom'] },
      },
      'push',
      inputs,
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    const a = result.jobs.find((j) => j.name === 'a');
    const b = result.jobs.find((j) => j.name === 'b');
    expect(a?.tags).toEqual(['shared']);
    expect(b?.tags).toEqual(['custom']);
  });
});

describe('simulate — YAML variables in rule context', () => {
  it('uses top-level YAML variables when evaluating job rules', () => {
    const result = simulate(
      {
        variables: { HAS_FRONTEND: 'false' },
        'build-frontend': {
          script: 'echo build',
          rules: [{ if: '$HAS_FRONTEND == "false"', when: 'never' }, { when: 'on_success' }],
        },
        'build-backend': {
          script: 'echo build',
          rules: [{ if: '$HAS_BACKEND == "false"', when: 'never' }, { when: 'on_success' }],
        },
      },
      'branch_creation',
      { defaultBranch: 'main', branchName: 'release/261.4' },
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.jobs.map((j) => j.name)).toEqual(['build-backend']);
    expect(result.activeVariables['HAS_FRONTEND']).toBe('false');
  });

  it('honors job-level variables overriding the top-level value', () => {
    const result = simulate(
      {
        variables: { FLAG: 'off' },
        a: {
          script: 'echo',
          variables: { FLAG: 'on' },
          rules: [{ if: '$FLAG == "on"', when: 'on_success' }, { when: 'never' }],
        },
        b: {
          script: 'echo',
          rules: [{ if: '$FLAG == "on"', when: 'on_success' }, { when: 'never' }],
        },
      },
      'push',
      inputs,
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.jobs.map((j) => j.name)).toEqual(['a']);
  });

  it('honors default.variables when the job has no override', () => {
    const result = simulate(
      {
        default: { variables: { REGION: 'eu' } },
        a: {
          script: 'echo',
          rules: [{ if: '$REGION == "eu"', when: 'on_success' }, { when: 'never' }],
        },
      },
      'push',
      inputs,
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.jobs.map((j) => j.name)).toEqual(['a']);
  });

  it('reads the value field of describable variable objects', () => {
    const result = simulate(
      {
        variables: {
          TESTSTAGE: { value: 'INT1', options: ['DEV1', 'INT1'], description: 'stage' },
        },
        a: {
          script: 'echo',
          rules: [{ if: '$TESTSTAGE == "INT1"', when: 'on_success' }, { when: 'never' }],
        },
      },
      'push',
      inputs,
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.jobs.map((j) => j.name)).toEqual(['a']);
    expect(result.activeVariables['TESTSTAGE']).toBe('INT1');
  });

  it('lets predefined trigger vars win over YAML vars (existing precedence)', () => {
    const result = simulate(
      {
        variables: { CI_COMMIT_BRANCH: 'fake' },
        a: {
          script: 'echo',
          rules: [{ if: '$CI_COMMIT_BRANCH == "main"', when: 'on_success' }, { when: 'never' }],
        },
      },
      'push',
      { defaultBranch: 'main', branchName: 'main' },
      [],
    );
    if (result.status !== 'complete') throw new Error('expected complete');
    expect(result.jobs.map((j) => j.name)).toEqual(['a']);
    expect(result.activeVariables['CI_COMMIT_BRANCH']).toBe('main');
  });
});
