import { isPlainObject } from './typeGuards';

const RESERVED_TOP_LEVEL_KEYS = new Set([
  'stages',
  'variables',
  'default',
  'workflow',
  'include',
  'image',
  'services',
  'before_script',
  'after_script',
  'cache',
]);

const TOP_LEVEL_FLATTEN_KEYS = ['include', 'cache', 'services'] as const;
const DEFAULT_BLOCK_FLATTEN_KEYS = ['cache', 'services', 'tags'] as const;
const JOB_FLATTEN_KEYS = [
  'rules',
  'cache',
  'services',
  'needs',
  'tags',
  'dependencies',
  'extends',
] as const;

export function normalizePipeline(parsed: unknown): unknown {
  if (!isPlainObject(parsed)) return parsed;
  return normalizePipelineObject(parsed);
}

export function normalizePipelineToObject(parsed: unknown): Record<string, unknown> | null {
  if (!isPlainObject(parsed)) return null;
  return normalizePipelineObject(parsed);
}

export function normalizePipelineObject(parsed: Record<string, unknown>): Record<string, unknown> {
  const root: Record<string, unknown> = { ...parsed };

  flattenKeys(root, TOP_LEVEL_FLATTEN_KEYS);

  if (isPlainObject(root['workflow'])) {
    const wf: Record<string, unknown> = { ...root['workflow'] };
    if (Array.isArray(wf['rules'])) wf['rules'] = flattenOnce(wf['rules']);
    root['workflow'] = wf;
  }

  if (isPlainObject(root['default'])) {
    const def: Record<string, unknown> = { ...root['default'] };
    flattenKeys(def, DEFAULT_BLOCK_FLATTEN_KEYS);
    root['default'] = def;
  }

  for (const [key, value] of Object.entries(root)) {
    if (RESERVED_TOP_LEVEL_KEYS.has(key)) continue;
    if (!isPlainObject(value)) continue;
    const job: Record<string, unknown> = { ...value };
    flattenKeys(job, JOB_FLATTEN_KEYS);
    root[key] = job;
  }

  return root;
}

function flattenKeys(target: Record<string, unknown>, keys: readonly string[]): void {
  for (const key of keys) {
    const value = target[key];
    if (Array.isArray(value)) target[key] = flattenOnce(value);
  }
}

function flattenOnce(arr: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const item of arr) {
    if (Array.isArray(item)) {
      for (const inner of item) out.push(inner);
    } else {
      out.push(item);
    }
  }
  return out;
}
