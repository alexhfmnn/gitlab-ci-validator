import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseYaml, validateYaml } from '../../lib/validator';

describe('parseYaml', () => {
  it('returns the parsed mapping for valid YAML', () => {
    const r = parseYaml('a:\n  script: echo\n');
    expect(r).toEqual({ a: { script: 'echo' } });
  });

  it('returns null for malformed YAML', () => {
    expect(parseYaml('a: : :')).toBeNull();
  });

  it('returns null for non-mapping roots (array, scalar)', () => {
    expect(parseYaml('- 1\n- 2\n')).toBeNull();
    expect(parseYaml('"scalar"')).toBeNull();
  });

  it('normalises nested rule arrays', () => {
    const r = parseYaml('a:\n  script: echo\n  rules:\n    - - if: $A\n    - if: $B\n');
    expect((r?.['a'] as { rules: unknown[] }).rules).toEqual([{ if: '$A' }, { if: '$B' }]);
  });
});

describe('validateYaml — short-circuit cases (no network)', () => {
  it('returns empty when input is whitespace only', async () => {
    const r = await validateYaml('   \n  ', '18.11');
    expect(r.status).toBe('empty');
  });

  it('returns yaml_error for malformed YAML', async () => {
    const r = await validateYaml('foo: : :\n', '18.11');
    expect(r.status).toBe('yaml_error');
  });

  it('returns invalid when root is not a mapping', async () => {
    const r = await validateYaml('- 1\n- 2\n', '18.11');
    expect(r.status).toBe('invalid');
  });
});

// ---------- Fetch-mocked schema flow ----------

// Catch-all permissive schema: every job (object value) may only have a known set of keys.
const JOB_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    stage: { type: 'string' },
    script: {},
    rules: { type: 'array' },
  },
};

const PERMISSIVE_SCHEMA = {
  type: 'object',
  properties: {
    stages: { type: 'array', items: { type: 'string' } },
    workflow: { type: 'object' },
    variables: { type: 'object' },
    default: { type: 'object' },
  },
  additionalProperties: JOB_SCHEMA,
};

function mockFetch(schema: unknown, ok = true, status = 200) {
  const fetchImpl = vi.fn(() =>
    Promise.resolve({
      ok,
      status,
      json: () => Promise.resolve(schema),
    } as unknown as Response),
  );
  vi.stubGlobal('fetch', fetchImpl);
  return fetchImpl;
}

describe('validateYaml — schema-aware flow', () => {
  // Bust the validator's compiled-schema cache between tests by using a
  // version label that does not match any cached entry on first use.
  // The `25.99` label below is registered in our fixture mock but the real
  // SCHEMA_VERSIONS table doesn't include it, so we rely on a real label
  // (`18.11`) and clear the module cache.
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns valid for a YAML that satisfies the schema', async () => {
    mockFetch(PERMISSIVE_SCHEMA);
    const { validateYaml: v } = await import('../../lib/validator');
    const r = await v('stages:\n  - build\nmyjob:\n  stage: build\n  script: echo\n', '18.11');
    expect(r.status).toBe('valid');
  });

  it('rewrites additionalProperties errors to "jobs:X config contains unknown keys: Y"', async () => {
    mockFetch(PERMISSIVE_SCHEMA);
    const { validateYaml: v } = await import('../../lib/validator');
    const r = await v('myjob:\n  bogus_key: 1\n  script: echo\n', '18.11');
    expect(r.status).toBe('invalid');
    if (r.status !== 'invalid') return;
    expect(
      r.errors.some((e) =>
        e.message.includes('jobs:myjob config contains unknown keys: bogus_key'),
      ),
    ).toBe(true);
  });

  it('returns invalid with helpful message when schema fetch fails', async () => {
    mockFetch({}, false, 404);
    const { validateYaml: v } = await import('../../lib/validator');
    const r = await v('myjob:\n  script: echo\n', '18.11');
    expect(r.status).toBe('invalid');
    if (r.status !== 'invalid') return;
    expect(r.errors[0]?.message).toMatch(/Could not load schema/);
  });

  it('returns invalid for unknown schema versions', async () => {
    mockFetch(PERMISSIVE_SCHEMA);
    const { validateYaml: v } = await import('../../lib/validator');
    const r = await v('myjob:\n  script: echo\n', '99.99');
    expect(r.status).toBe('invalid');
  });

  it('caches compiled schemas across invocations', async () => {
    const fetchImpl = mockFetch(PERMISSIVE_SCHEMA);
    const { validateYaml: v } = await import('../../lib/validator');
    await v('myjob:\n  script: echo\n', '18.11');
    await v('myjob:\n  script: again\n', '18.11');
    // Two validations, but only one schema fetch.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reports a regular AJV error with a line number for nested keys', async () => {
    mockFetch({
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: { script: { type: 'string' } },
        additionalProperties: true,
      },
    });
    const { validateYaml: v } = await import('../../lib/validator');
    const r = await v('myjob:\n  script: 42\n', '18.11');
    expect(r.status).toBe('invalid');
    if (r.status !== 'invalid') return;
    expect(r.errors[0]?.message).toBeTruthy();
  });

  it('reports a top-level unknown key with a line and "Pipeline config" message', async () => {
    mockFetch({
      type: 'object',
      additionalProperties: false,
      properties: {
        myjob: { type: 'object' },
      },
    });
    const { validateYaml: v } = await import('../../lib/validator');
    const r = await v('myjob: {}\nbogus_root: 1\n', '18.11');
    expect(r.status).toBe('invalid');
    if (r.status !== 'invalid') return;
    expect(
      r.errors.some(
        (e) =>
          e.message.includes('Pipeline config contains unknown keys: bogus_root') && e.line === 2,
      ),
    ).toBe(true);
  });

  it('formats reserved-key additionalProperty errors with the segment name', async () => {
    mockFetch({
      type: 'object',
      properties: {
        variables: {
          type: 'object',
          additionalProperties: false,
          properties: { ALLOWED: {} },
        },
      },
    });
    const { validateYaml: v } = await import('../../lib/validator');
    const r = await v('variables:\n  WEIRD: 1\n', '18.11');
    expect(r.status).toBe('invalid');
    if (r.status !== 'invalid') return;
    expect(
      r.errors.some((e) => e.message.includes('variables config contains unknown keys: WEIRD')),
    ).toBe(true);
  });

  it('dedupes identical errors', async () => {
    mockFetch({
      type: 'object',
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        properties: { script: {} },
      },
    });
    const { validateYaml: v } = await import('../../lib/validator');
    const r = await v('myjob:\n  bogus: 1\n  another: 2\n', '18.11');
    if (r.status !== 'invalid') throw new Error('expected invalid');
    const messages = r.errors.map((e) => e.message);
    expect(new Set(messages).size).toBe(messages.length);
  });

  it('also reports semantic stage-existence errors alongside schema validation', async () => {
    mockFetch(PERMISSIVE_SCHEMA);
    const { validateYaml: v } = await import('../../lib/validator');
    const r = await v('stages:\n  - build\njob:\n  stage: nonexistent\n  script: echo\n', '18.11');
    expect(r.status).toBe('invalid');
    if (r.status !== 'invalid') return;
    expect(
      r.errors.some((e) => e.message.includes('chosen stage nonexistent does not exist')),
    ).toBe(true);
  });
});
