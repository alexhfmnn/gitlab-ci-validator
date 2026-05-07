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

  if (isPlainObject(root['workflow'])) {
    const wf: Record<string, unknown> = { ...root['workflow'] };
    if (Array.isArray(wf['rules'])) wf['rules'] = flattenOnce(wf['rules']);
    root['workflow'] = wf;
  }

  for (const [key, value] of Object.entries(root)) {
    if (RESERVED_TOP_LEVEL_KEYS.has(key)) continue;
    if (!isPlainObject(value)) continue;
    const job: Record<string, unknown> = { ...value };
    if (Array.isArray(job['rules'])) job['rules'] = flattenOnce(job['rules']);
    root[key] = job;
  }

  return root;
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
