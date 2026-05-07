# CI.md

GitHub Actions workflow specifications.

---

## `.github/workflows/ci.yml`

Runs on every push and every pull request. Cancels superseded runs on the same ref.

```yaml
name: CI

on:
  push:
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with:
          node-version: lts/*
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm run lint

      - name: Format check
        run: pnpm run format:check

      - name: Type check
        run: pnpm exec tsc -b

      - name: Unit tests with coverage
        run: pnpm run test:coverage

      - name: Build
        run: pnpm run build

      - name: Dependency audit (production)
        run: pnpm audit --prod
        continue-on-error: true
```

`test:coverage` writes `coverage/lcov.info`, which is what `sonar-project.properties` points
SonarQube at when a scan is run.

---

## `.github/workflows/deploy.yml`

Runs on push to `main` (and via `workflow_dispatch`). Fetches schemas, builds, deploys to `gh-pages`.

```yaml
name: Deploy

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v6
        with:
          node-version: lts/*
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Restore schema cache
        uses: actions/cache@v5
        with:
          path: public/schemas
          key: schemas-${{ hashFiles('src/schemas.config.ts') }}

      - name: Fetch schemas
        run: pnpm run fetch-schemas
        # Fails immediately on any missing tag, 404, or network error.
        # If schemas were restored from cache and all files exist,
        # fetch-schemas.ts skips files that are already present.
        # The pnpm script invokes the script via `tsx` (declared in devDependencies).

      - name: Build
        run: pnpm run build

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## `.github/workflows/codeql.yml`

CodeQL security analysis — runs on push/PR to `main` and weekly on Mondays at 04:00 UTC.

```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 4 * * 1'

permissions:
  contents: read
  security-events: write
  actions: read

concurrency:
  group: codeql-${{ github.ref }}
  cancel-in-progress: true

jobs:
  analyze:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        language: [javascript-typescript]
    steps:
      - uses: actions/checkout@v6
      - uses: github/codeql-action/init@v4
        with:
          languages: ${{ matrix.language }}
          queries: security-extended
      - uses: github/codeql-action/analyze@v4
        with:
          category: '/language:${{ matrix.language }}'
```

---

## Schema Fetch Script: `scripts/fetch-schemas.ts`

Behaviour:

- Reads `SCHEMA_VERSIONS` from `src/schemas.config.ts`
- For each version, constructs the URL:
  `https://gitlab.com/gitlab-org/gitlab/-/raw/{ref}/app/assets/javascripts/editor/schema/ci.json`
- If the output file already exists in `public/schemas/` (cache hit), skips the download
- If the file does not exist, fetches it
- On any HTTP error (non-200), missing tag, or network failure: logs the error and exits with code 1
- On success: writes the file to `public/schemas/{filename}`
- After all downloads: logs a summary of fetched vs. skipped versions

Exit code 1 on any failure — blocks the build.

---

## Vite Config

```ts
// vite.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/gitlab-ci-validator/',
  // … manualChunks, test config, etc.
});
```

---

## SonarQube Scanning

`sonar-project.properties` lives at the repo root and is consumed by the `sonarsource/sonar-scanner-cli` Docker image (run locally against the `docker-compose.yml` SonarQube community stack — there is no GitHub Actions Sonar workflow in this repo).

Key invariants:

- `sonar.sources=src,scripts` and `sonar.tests=src/__tests__`
- `src/__tests__/**` is added to `sonar.exclusions` so the same file is never indexed twice
  (Sonar requires `sources` and `tests` to be disjoint).
- Coverage is read from `coverage/lcov.info` for both JS and TS analyzers; the scan must
  run **after** `pnpm run test:coverage` so the report exists.
- `sonar.coverage.exclusions` strips entry points, type-only files, CSS, and the test tree
  itself so they do not drag the coverage percentage down.

---

## Final Deployment URL

`https://<github-username>.github.io/gitlab-ci-validator/`
