import type { ValidationError } from '../types';
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
  'spec',
]);

const DEFAULT_STAGES = ['build', 'test', 'deploy'];

export function validateSemantics(
  parsed: Record<string, unknown>,
  yamlText: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  const declared = Array.isArray(parsed['stages'])
    ? parsed['stages'].filter((s): s is string => typeof s === 'string')
    : DEFAULT_STAGES;

  const allowed = new Set<string>([...declared, '.pre', '.post']);

  const displayList = ['.pre', ...declared.filter((s) => s !== '.pre' && s !== '.post'), '.post'];

  for (const [jobName, value] of Object.entries(parsed)) {
    if (RESERVED_TOP_LEVEL_KEYS.has(jobName)) continue;
    if (jobName.startsWith('.')) continue; // hidden / template jobs
    if (!isPlainObject(value)) continue;

    const stage = value['stage'];
    if (typeof stage !== 'string') continue;

    if (allowed.has(stage)) continue;
    const line = findKeyLineUnderTopLevel(jobName, 'stage', yamlText);
    errors.push({
      path: `/${jobName}/stage`,
      message: `${jobName} job: chosen stage ${stage} does not exist; available stages are ${displayList.join(', ')}`,
      ...(line === undefined ? {} : { line }),
    });
  }

  return errors;
}

export function findKeyLineUnderTopLevel(
  topKey: string,
  subKey: string,
  yamlText: string,
): number | undefined {
  const lines = yamlText.split('\n');
  const topRe = new RegExp(String.raw`^${escapeRegex(topKey)}\s*:`);
  const subRe = new RegExp(String.raw`^\s+${escapeRegex(subKey)}\s*:`);

  let topLine = -1;
  for (const [i, line] of lines.entries()) {
    if (topRe.test(line)) {
      topLine = i;
      break;
    }
  }
  if (topLine < 0) return undefined;

  for (const [i, line] of lines.entries()) {
    if (i <= topLine) continue;
    if (line === '') continue;
    if (/^\S/.test(line)) break; // next top-level key
    if (subRe.test(line)) return i + 1;
  }
  return undefined;
}

function escapeRegex(s: string): string {
  return s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
