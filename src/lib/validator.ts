import Ajv, { type AnySchema, type ErrorObject, type ValidateFunction } from 'ajv';
import yaml from 'js-yaml';
import type { ValidationError, ValidationResult } from '../types';
import { SCHEMA_VERSIONS } from '../schemas.config';
import { normalizePipelineObject, normalizePipelineToObject } from './normalizePipeline';
import { findKeyLineUnderTopLevel, validateSemantics } from './semanticValidator';
import { errorMessage, isPlainObject } from './typeGuards';

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

const compiledCache = new Map<string, ValidateFunction>();

async function loadCompiled(versionLabel: string): Promise<ValidateFunction> {
  const cached = compiledCache.get(versionLabel);
  if (cached) return cached;

  const versionEntry = SCHEMA_VERSIONS.find((v) => v.label === versionLabel);
  if (!versionEntry) throw new Error(`Unknown schema version: ${versionLabel}`);

  const url = `${import.meta.env.BASE_URL}schemas/${versionEntry.filename}`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to load schema ${versionEntry.filename}: HTTP ${res.status}`);
  const schema = (await res.json()) as AnySchema;

  const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
  const validate = ajv.compile(schema);
  compiledCache.set(versionLabel, validate);
  return validate;
}

export async function validateYaml(
  yamlText: string,
  versionLabel: string,
): Promise<ValidationResult> {
  if (yamlText.trim() === '') {
    return { status: 'empty' };
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(yamlText);
  } catch (err) {
    const line = extractYamlErrorLine(err);
    return {
      status: 'yaml_error',
      message: errorMessage(err),
      ...(line === undefined ? {} : { line }),
    };
  }

  if (isPlainObject(parsed)) {
    return runSchemaValidation(parsed, yamlText, versionLabel);
  }
  return {
    status: 'invalid',
    errors: [{ path: '/', message: 'Expected a YAML mapping at the top level' }],
  };
}

async function runSchemaValidation(
  parsed: Record<string, unknown>,
  yamlText: string,
  versionLabel: string,
): Promise<ValidationResult> {
  const normalized = normalizePipelineObject(parsed);

  let validate: ValidateFunction;
  try {
    validate = await loadCompiled(versionLabel);
  } catch (err) {
    return {
      status: 'invalid',
      errors: [
        { path: '/', message: `Could not load schema for ${versionLabel}: ${errorMessage(err)}` },
      ],
    };
  }

  const ok = validate(normalized);
  const errors: ValidationError[] = [];

  if (!ok) {
    for (const e of validate.errors ?? []) {
      errors.push(formatAjvError(e, yamlText));
    }
  }

  for (const e of validateSemantics(normalized, yamlText)) {
    errors.push(e);
  }

  if (errors.length === 0) return { status: 'valid', parsed: normalized };
  return { status: 'invalid', errors: dedupeErrors(errors) };
}

export function parseYaml(yamlText: string): Record<string, unknown> | null {
  try {
    const parsed = yaml.load(yamlText);
    return normalizePipelineToObject(parsed);
  } catch {
    return null;
  }
}

function extractYamlErrorLine(err: unknown): number | undefined {
  if (!isPlainObject(err)) return undefined;
  const mark = err['mark'];
  if (!isPlainObject(mark)) return undefined;
  return typeof mark['line'] === 'number' ? mark['line'] + 1 : undefined;
}

function formatAjvError(e: ErrorObject, yamlText: string): ValidationError {
  const instancePath = e.instancePath || '';
  const topSegment = instancePath.split('/').find(Boolean);

  if (e.keyword === 'additionalProperties') {
    const unknownKey = extractUnknownKey(e);
    if (unknownKey) {
      return formatUnknownKeyError(instancePath, topSegment, unknownKey, yamlText);
    }
  }

  return {
    path: instancePath || '/',
    message: e.message ?? 'unknown error',
    ...resolveLine(instancePath, yamlText),
  };
}

function extractUnknownKey(e: ErrorObject): string | undefined {
  if (!isPlainObject(e.params)) return undefined;
  const key = e.params['additionalProperty'];
  return typeof key === 'string' ? key : undefined;
}

function formatUnknownKeyError(
  instancePath: string,
  topSegment: string | undefined,
  unknownKey: string,
  yamlText: string,
): ValidationError {
  const message = unknownKeyMessage(topSegment, unknownKey);
  const line =
    topSegment === undefined
      ? findTopLevelKeyLine(unknownKey, yamlText)
      : findKeyLineUnderTopLevel(topSegment, unknownKey, yamlText);

  return {
    path: instancePath ? `${instancePath}/${unknownKey}` : `/${unknownKey}`,
    message,
    ...(line === undefined ? {} : { line }),
  };
}

function unknownKeyMessage(topSegment: string | undefined, unknownKey: string): string {
  if (topSegment === undefined) return `Pipeline config contains unknown keys: ${unknownKey}`;
  if (RESERVED_TOP_LEVEL_KEYS.has(topSegment)) {
    return `${topSegment} config contains unknown keys: ${unknownKey}`;
  }
  return `jobs:${topSegment} config contains unknown keys: ${unknownKey}`;
}

function dedupeErrors(errors: ValidationError[]): ValidationError[] {
  const seen = new Set<string>();
  const out: ValidationError[] = [];
  for (const e of errors) {
    const key = `${e.path}|${e.message}|${e.line ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function findTopLevelKeyLine(key: string, yamlText: string): number | undefined {
  const re = new RegExp(String.raw`^${escapeRegex(key)}\s*:`);
  for (const [i, line] of yamlText.split('\n').entries()) {
    if (re.test(line)) return i + 1;
  }
  return undefined;
}

function resolveLine(instancePath: string, yamlText: string): { line?: number } {
  if (instancePath === '' || instancePath === '/') return {};
  const segments = instancePath.split('/').filter(Boolean);
  const lastKey = segments.at(-1);
  if (lastKey === undefined || /^\d+$/.test(lastKey)) return {};

  const re = new RegExp(String.raw`^\s*${escapeRegex(lastKey)}\s*:`);
  for (const [i, line] of yamlText.split('\n').entries()) {
    if (re.test(line)) return { line: i + 1 };
  }
  return {};
}

function escapeRegex(s: string): string {
  return s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}
