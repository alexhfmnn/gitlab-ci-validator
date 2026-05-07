import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadDefaultBranch,
  loadDismissedVersionWarning,
  loadGitlabVersion,
  loadScopedVariables,
  loadYamlDraft,
  saveDefaultBranch,
  saveDismissedVersionWarning,
  saveGitlabVersion,
  saveScopedVariables,
  saveYamlDraft,
} from '../../lib/scopedVarStorage';

const KEYS = [
  'gcv:variables:scoped',
  'gcv:settings:gitlabVersion',
  'gcv:settings:defaultBranch',
  'gcv:dismissed:versionWarning',
];
const SESSION_KEYS = ['gcv:yaml'];

function resetStorage() {
  for (const k of KEYS) localStorage.removeItem(k);
  for (const k of SESSION_KEYS) sessionStorage.removeItem(k);
}

beforeEach(resetStorage);
afterEach(resetStorage);

describe('scoped variables', () => {
  it('round-trips an array of CustomVariable', () => {
    const vars = [
      { id: 'a', key: 'TOKEN', value: 'abc' },
      { id: 'b', key: 'REGION', value: 'eu-central', note: 'aws' },
    ];
    saveScopedVariables(vars);
    expect(loadScopedVariables()).toEqual(vars);
  });

  it('returns [] when storage is empty', () => {
    expect(loadScopedVariables()).toEqual([]);
  });

  it('returns [] when stored JSON is not an array', () => {
    localStorage.setItem('gcv:variables:scoped', '"not-an-array"');
    expect(loadScopedVariables()).toEqual([]);
  });

  it('returns [] when stored JSON is malformed', () => {
    localStorage.setItem('gcv:variables:scoped', '{not json}');
    expect(loadScopedVariables()).toEqual([]);
  });

  it('filters out entries with the wrong shape', () => {
    localStorage.setItem(
      'gcv:variables:scoped',
      JSON.stringify([
        { id: 'a', key: 'GOOD', value: 'ok' },
        { id: 1, key: 'BAD' }, // wrong types
        null,
      ]),
    );
    expect(loadScopedVariables()).toEqual([{ id: 'a', key: 'GOOD', value: 'ok' }]);
  });
});

describe('YAML draft', () => {
  it('round-trips via sessionStorage', () => {
    saveYamlDraft('stages:\n  - build\n');
    expect(loadYamlDraft()).toBe('stages:\n  - build\n');
  });

  it('returns null when nothing stored', () => {
    expect(loadYamlDraft()).toBeNull();
  });
});

describe('storage error handling', () => {
  it('returns null when sessionStorage.getItem throws', () => {
    const original = sessionStorage.getItem.bind(sessionStorage);
    sessionStorage.getItem = () => {
      throw new Error('boom');
    };
    try {
      expect(loadYamlDraft()).toBeNull();
    } finally {
      sessionStorage.getItem = original;
    }
  });

  it('returns null when localStorage.getItem throws (settings reads)', () => {
    const original = localStorage.getItem.bind(localStorage);
    localStorage.getItem = () => {
      throw new Error('boom');
    };
    try {
      expect(loadGitlabVersion()).toBeNull();
      expect(loadDefaultBranch()).toBeNull();
      expect(loadDismissedVersionWarning()).toBeNull();
    } finally {
      localStorage.getItem = original;
    }
  });

  it('swallows quota errors when writing scoped variables / yaml / settings', () => {
    const origLocalSet = localStorage.setItem.bind(localStorage);
    const origSessionSet = sessionStorage.setItem.bind(sessionStorage);
    localStorage.setItem = () => {
      throw new Error('quota');
    };
    sessionStorage.setItem = () => {
      throw new Error('quota');
    };
    try {
      expect(() => {
        saveScopedVariables([]);
      }).not.toThrow();
      expect(() => {
        saveYamlDraft('x');
      }).not.toThrow();
      expect(() => {
        saveGitlabVersion('18.11');
      }).not.toThrow();
      expect(() => {
        saveDefaultBranch('main');
      }).not.toThrow();
      expect(() => {
        saveDismissedVersionWarning('18.11');
      }).not.toThrow();
    } finally {
      localStorage.setItem = origLocalSet;
      sessionStorage.setItem = origSessionSet;
    }
  });
});

describe('settings persistence', () => {
  it('round-trips the GitLab version', () => {
    saveGitlabVersion('18.10');
    expect(loadGitlabVersion()).toBe('18.10');
  });

  it('round-trips the default branch', () => {
    saveDefaultBranch('develop');
    expect(loadDefaultBranch()).toBe('develop');
  });

  it('round-trips the dismissed-version-warning marker', () => {
    saveDismissedVersionWarning('18.11');
    expect(loadDismissedVersionWarning()).toBe('18.11');
  });

  it('returns null for settings that have not been stored', () => {
    expect(loadGitlabVersion()).toBeNull();
    expect(loadDefaultBranch()).toBeNull();
    expect(loadDismissedVersionWarning()).toBeNull();
  });
});
