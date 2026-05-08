import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA_VERSIONS } from '../src/schemas.config.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'schemas');

const SCHEMA_URL = (ref: string) =>
  `https://gitlab.com/gitlab-org/gitlab/-/raw/${ref}/app/assets/javascripts/editor/schema/ci.json`;

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function fetchOne(ref: string, filename: string): Promise<'fetched' | 'skipped'> {
  const target = join(OUT_DIR, filename);
  if (await fileExists(target)) return 'skipped';

  const url = SCHEMA_URL(ref);
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'https:' || parsedUrl.host !== 'gitlab.com') {
    throw new Error(`Refusing to fetch from untrusted origin: ${url}`);
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} — HTTP ${res.status} ${res.statusText}`);
  }
  const body = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (e) {
    throw new Error(`Schema at ${url} is not valid JSON: ${(e as Error).message}`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Schema at ${url} is not a JSON object`);
  }
  // codeql[js/http-to-file-access] Build-time-only fetch from a pinned https://gitlab.com URL with
  // tagged refs from src/schemas.config.ts. The body is JSON.parse-validated, shape-checked, and
  // re-serialized; the file is consumed only as JSON-Schema input to AJV (no exec, no path use).
  await writeFile(target, JSON.stringify(parsed), 'utf-8');
  return 'fetched';
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const results: { label: string; status: 'fetched' | 'skipped' }[] = [];

  for (const v of SCHEMA_VERSIONS) {
    process.stdout.write(`  ${v.label} (${v.ref}) ... `);
    const status = await fetchOne(v.ref, v.filename);
    results.push({ label: v.label, status });
    process.stdout.write(`${status}\n`);
  }

  const fetched = results.filter((r) => r.status === 'fetched').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  console.log(`\nSchemas: ${fetched} fetched, ${skipped} skipped (cached).`);
}

try {
  await main();
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nfetch-schemas failed: ${msg}`);
  process.exit(1);
}
