import type { CustomVariable } from '../types';

const SCOPED_KEY = 'gcv:variables:scoped';
const YAML_KEY = 'gcv:yaml';
const VERSION_KEY = 'gcv:settings:gitlabVersion';
const DEFAULT_BRANCH_KEY = 'gcv:settings:defaultBranch';
const DISMISSED_VERSION_KEY = 'gcv:dismissed:versionWarning';

export function loadScopedVariables(): CustomVariable[] {
  try {
    const raw = localStorage.getItem(SCOPED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCustomVariable);
  } catch {
    return [];
  }
}

export function saveScopedVariables(vars: CustomVariable[]): void {
  try {
    localStorage.setItem(SCOPED_KEY, JSON.stringify(vars));
  } catch {
    // quota or storage disabled — ignore
  }
}

export function loadYamlDraft(): string | null {
  try {
    return sessionStorage.getItem(YAML_KEY);
  } catch {
    return null;
  }
}

export function saveYamlDraft(text: string): void {
  try {
    sessionStorage.setItem(YAML_KEY, text);
  } catch {
    // ignore
  }
}

export function loadGitlabVersion(): string | null {
  return readLocalString(VERSION_KEY);
}

export function saveGitlabVersion(version: string): void {
  writeLocalString(VERSION_KEY, version);
}

export function loadDefaultBranch(): string | null {
  return readLocalString(DEFAULT_BRANCH_KEY);
}

export function saveDefaultBranch(branch: string): void {
  writeLocalString(DEFAULT_BRANCH_KEY, branch);
}

export function loadDismissedVersionWarning(): string | null {
  return readLocalString(DISMISSED_VERSION_KEY);
}

export function saveDismissedVersionWarning(latestLabel: string): void {
  writeLocalString(DISMISSED_VERSION_KEY, latestLabel);
}

function readLocalString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function isCustomVariable(value: unknown): value is CustomVariable {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['id'] === 'string' &&
    typeof v['key'] === 'string' &&
    typeof v['value'] === 'string' &&
    (v['note'] === undefined || typeof v['note'] === 'string')
  );
}
