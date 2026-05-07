import type { ResolvedScripts } from '../types';

export function resolveScripts(
  job: Record<string, unknown>,
  globalDefault: Record<string, unknown> | undefined,
): ResolvedScripts {
  return {
    beforeScript: pickScript(job['before_script'], globalDefault?.['before_script']),
    script: pickScript(job['script'], undefined),
    afterScript: pickScript(job['after_script'], globalDefault?.['after_script']),
  };
}

function pickScript(jobValue: unknown, defaultValue: unknown): string[] {
  if (jobValue !== undefined) return normalize(jobValue);
  if (defaultValue !== undefined) return normalize(defaultValue);
  return [];
}

function normalize(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      if (typeof entry === 'string') return [entry];
      if (Array.isArray(entry)) {
        return entry.filter((s): s is string => typeof s === 'string');
      }
      return [];
    });
  }
  return [];
}
