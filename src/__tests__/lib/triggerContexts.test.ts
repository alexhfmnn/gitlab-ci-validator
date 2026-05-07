import { describe, expect, it } from 'vitest';
import { buildVariableContext, predefinedKeys, slugify } from '../../lib/triggerContexts';
import type { CustomVariable, TriggerInputs } from '../../types';

const baseInputs: TriggerInputs = { defaultBranch: 'main', branchName: 'main' };

function asVar(key: string, value: string, id = key): CustomVariable {
  return { id, key, value };
}

describe('slugify', () => {
  it('lowercases and dasherizes non-alphanumerics', () => {
    expect(slugify('Feature/Branch_42')).toBe('feature-branch-42');
  });

  it('strips leading/trailing dashes', () => {
    expect(slugify('---abc---')).toBe('abc');
  });

  it('truncates to 63 characters and trims trailing dashes', () => {
    const s = slugify('a'.repeat(80));
    expect(s.length).toBeLessThanOrEqual(63);
  });
});

describe('buildVariableContext — push', () => {
  it('sets CI_COMMIT_BRANCH and CI_DEFAULT_BRANCH', () => {
    const ctx = buildVariableContext(
      'push',
      { defaultBranch: 'main', branchName: 'feature/x' },
      [],
    );
    expect(ctx['CI_PIPELINE_SOURCE']).toBe('push');
    expect(ctx['CI_COMMIT_BRANCH']).toBe('feature/x');
    expect(ctx['CI_COMMIT_REF_NAME']).toBe('feature/x');
    expect(ctx['CI_COMMIT_REF_SLUG']).toBe('feature-x');
    expect(ctx['CI_DEFAULT_BRANCH']).toBe('main');
    expect(ctx['CI_COMMIT_TAG']).toBeUndefined();
  });
});

describe('buildVariableContext — tag_push', () => {
  it('sets CI_COMMIT_TAG and omits CI_COMMIT_BRANCH', () => {
    const ctx = buildVariableContext('tag_push', { defaultBranch: 'main', tagName: 'v1.2.3' }, []);
    expect(ctx['CI_COMMIT_TAG']).toBe('v1.2.3');
    expect(ctx['CI_COMMIT_REF_NAME']).toBe('v1.2.3');
    expect(ctx['CI_COMMIT_BRANCH']).toBeUndefined();
  });
});

describe('buildVariableContext — merge_request', () => {
  it('sets MR variables and omits CI_COMMIT_BRANCH (detached pipeline)', () => {
    const ctx = buildVariableContext(
      'merge_request',
      {
        defaultBranch: 'main',
        mrSourceBranch: 'feat/login',
        mrTargetBranch: 'main',
        mrIsDraft: false,
      },
      [],
    );
    expect(ctx['CI_PIPELINE_SOURCE']).toBe('merge_request_event');
    expect(ctx['CI_MERGE_REQUEST_SOURCE_BRANCH_NAME']).toBe('feat/login');
    expect(ctx['CI_MERGE_REQUEST_TARGET_BRANCH_NAME']).toBe('main');
    expect(ctx['CI_MERGE_REQUEST_DRAFT']).toBe('false');
    expect(ctx['CI_MERGE_REQUEST_EVENT_TYPE']).toBe('detached');
    expect(ctx['CI_COMMIT_BRANCH']).toBeUndefined();
  });

  it('marks draft and prefixes title with "Draft:" when mrIsDraft is true', () => {
    const ctx = buildVariableContext(
      'merge_request',
      { defaultBranch: 'main', mrSourceBranch: 'feat', mrTargetBranch: 'main', mrIsDraft: true },
      [],
    );
    expect(ctx['CI_MERGE_REQUEST_DRAFT']).toBe('true');
    expect(ctx['CI_MERGE_REQUEST_TITLE']?.startsWith('Draft:')).toBe(true);
  });
});

describe('buildVariableContext — refKind branch vs tag (web/api/trigger/schedule)', () => {
  it('web with refKind=tag sets CI_COMMIT_TAG, not CI_COMMIT_BRANCH', () => {
    const ctx = buildVariableContext(
      'web',
      { defaultBranch: 'main', tagName: 'release/264.1', refKind: 'tag' },
      [],
    );
    expect(ctx['CI_COMMIT_TAG']).toBe('release/264.1');
    expect(ctx['CI_COMMIT_BRANCH']).toBeUndefined();
  });

  it('api with refKind=branch sets CI_COMMIT_BRANCH', () => {
    const ctx = buildVariableContext(
      'api',
      { defaultBranch: 'main', branchName: 'main', refKind: 'branch' },
      [],
    );
    expect(ctx['CI_COMMIT_BRANCH']).toBe('main');
    expect(ctx['CI_COMMIT_TAG']).toBeUndefined();
  });

  it('trigger sets CI_PIPELINE_TRIGGERED', () => {
    const ctx = buildVariableContext('trigger', baseInputs, []);
    expect(ctx['CI_PIPELINE_TRIGGERED']).toBe('true');
  });

  it('schedule includes CI_PIPELINE_SCHEDULE_DESCRIPTION when set', () => {
    const ctx = buildVariableContext(
      'schedule',
      { defaultBranch: 'main', branchName: 'main', scheduleDescription: 'nightly' },
      [],
    );
    expect(ctx['CI_PIPELINE_SCHEDULE_DESCRIPTION']).toBe('nightly');
  });

  it('schedule omits CI_PIPELINE_SCHEDULE_DESCRIPTION when blank', () => {
    const ctx = buildVariableContext(
      'schedule',
      { defaultBranch: 'main', branchName: 'main', scheduleDescription: '   ' },
      [],
    );
    expect(ctx['CI_PIPELINE_SCHEDULE_DESCRIPTION']).toBeUndefined();
  });
});

describe('buildVariableContext — variable precedence', () => {
  it('predefined wins over scoped and custom', () => {
    const ctx = buildVariableContext(
      'push',
      baseInputs,
      [asVar('CI_COMMIT_BRANCH', 'hijack')],
      [asVar('CI_COMMIT_BRANCH', 'hijack-scoped')],
    );
    expect(ctx['CI_COMMIT_BRANCH']).toBe('main');
  });

  it('custom overrides scoped for non-predefined keys', () => {
    const ctx = buildVariableContext(
      'push',
      baseInputs,
      [asVar('TOKEN', 'from-custom')],
      [asVar('TOKEN', 'from-scoped')],
    );
    expect(ctx['TOKEN']).toBe('from-custom');
  });

  it('scoped is applied when no custom override exists', () => {
    const ctx = buildVariableContext('push', baseInputs, [], [asVar('REGION', 'eu-central-1')]);
    expect(ctx['REGION']).toBe('eu-central-1');
  });

  it('skips entries with empty key', () => {
    const ctx = buildVariableContext('push', baseInputs, [{ id: 'x', key: '', value: 'noop' }]);
    expect(Object.values(ctx)).not.toContain('noop');
  });
});

describe('buildVariableContext — branch_creation', () => {
  it('sets push-source semantics with the new branch name', () => {
    const ctx = buildVariableContext(
      'branch_creation',
      { defaultBranch: 'main', branchName: 'feat/x' },
      [],
    );
    expect(ctx['CI_PIPELINE_SOURCE']).toBe('push');
    expect(ctx['CI_COMMIT_BRANCH']).toBe('feat/x');
    expect(ctx['CI_COMMIT_REF_NAME']).toBe('feat/x');
    expect(ctx['CI_DEFAULT_BRANCH']).toBe('main');
  });
});

describe('buildVariableContext — schedule with empty inputs and defaults', () => {
  it('falls back to default branch when branchName is empty', () => {
    const ctx = buildVariableContext(
      'schedule',
      { defaultBranch: 'main', branchName: '   ', refKind: 'branch' },
      [],
    );
    expect(ctx['CI_COMMIT_BRANCH']).toBe('main');
  });

  it('falls back to branchName when tagName is empty (refKind=tag)', () => {
    const ctx = buildVariableContext(
      'web',
      { defaultBranch: 'main', branchName: 'release-1.0', tagName: '   ', refKind: 'tag' },
      [],
    );
    expect(ctx['CI_COMMIT_TAG']).toBe('release-1.0');
  });
});

describe('buildVariableContext — fallback defaults', () => {
  it('falls back to "main" when defaultBranch is empty', () => {
    const ctx = buildVariableContext('push', { defaultBranch: '', branchName: '' }, []);
    expect(ctx['CI_DEFAULT_BRANCH']).toBe('main');
    expect(ctx['CI_COMMIT_BRANCH']).toBe('main');
  });

  it('falls back to "v0.0.0" when tag_push tagName is empty', () => {
    const ctx = buildVariableContext('tag_push', { defaultBranch: 'main', tagName: '' }, []);
    expect(ctx['CI_COMMIT_TAG']).toBe('v0.0.0');
  });

  it('falls back to "feature-branch" when MR source is empty', () => {
    const ctx = buildVariableContext(
      'merge_request',
      { defaultBranch: 'main', mrSourceBranch: '', mrTargetBranch: '' },
      [],
    );
    expect(ctx['CI_MERGE_REQUEST_SOURCE_BRANCH_NAME']).toBe('feature-branch');
    expect(ctx['CI_MERGE_REQUEST_TARGET_BRANCH_NAME']).toBe('main');
  });

  it('produces empty CI_COMMIT_TAG when tag and branch are both unset (refKind=tag)', () => {
    const ctx = buildVariableContext('web', { defaultBranch: 'main', refKind: 'tag' }, []);
    expect(ctx['CI_COMMIT_TAG']).toBe('');
  });
});

describe('predefinedKeys', () => {
  it('returns the set of predefined keys for a trigger', () => {
    const keys = predefinedKeys('push', baseInputs);
    expect(keys.has('CI_COMMIT_BRANCH')).toBe(true);
    expect(keys.has('CI_PIPELINE_SOURCE')).toBe(true);
    expect(keys.has('TOKEN')).toBe(false);
  });
});
