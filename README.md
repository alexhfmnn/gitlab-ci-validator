# GitLab CI Validator & Simulator

Static GitHub Pages app that validates `.gitlab-ci.yml` files against bundled GitLab CI JSON Schemas and simulates pipeline runs locally. No backend, no API calls.

Live URL: `https://<github-username>.github.io/gitlab-ci-validator/`

## How GitHub Pages deployment works

Two GitHub Actions workflows live under `.github/workflows/`:

| Workflow     | Trigger                                        | Purpose                                                     |
| ------------ | ---------------------------------------------- | ----------------------------------------------------------- |
| `ci.yml`     | every push and PR                              | runs `pnpm lint`, `pnpm format:check`, `pnpm test`          |
| `deploy.yml` | push to `main` (or manual `workflow_dispatch`) | fetches schemas, builds, publishes to the `gh-pages` branch |

The `deploy.yml` job:

1. **Checkout + pnpm + Node** — `pnpm/action-setup@v4` then `actions/setup-node@v4` with `cache: pnpm`.
2. **`pnpm install --frozen-lockfile`** — installs locked dependencies.
3. **Restore schema cache** — `actions/cache@v4` keyed by `hashFiles('src/schemas.config.ts')`. Bumping any entry in `schemas.config.ts` invalidates the cache and forces a fresh fetch.
4. **`pnpm run fetch-schemas`** — runs `scripts/fetch-schemas.ts` (via `tsx`). For each entry in `SCHEMA_VERSIONS`, downloads `https://gitlab.com/gitlab-org/gitlab/-/raw/{ref}/app/assets/javascripts/editor/schema/ci.json` to `public/schemas/{filename}`. Skips files already restored from cache. Fails the build immediately on any 404, network error, or invalid JSON.
5. **`pnpm run build`** — `tsc -b && vite build`. Vite emits the bundle into `dist/` with `base: '/gitlab-ci-validator/'` so all asset paths are correct under the Pages subpath.
6. **`peaceiris/actions-gh-pages@v4`** — pushes `dist/` to the `gh-pages` branch using the workflow's `GITHUB_TOKEN`.

The workflow declares `permissions: contents: write` so the token is allowed to push to `gh-pages`. `concurrency: pages` cancels in-flight deploys when a new push lands.

## Repo settings required for Pages

In your fork's **Settings → Pages**:

- **Source**: _Deploy from a branch_
- **Branch**: `gh-pages` / `(root)`

The first push to `main` after configuring the workflow creates the `gh-pages` branch automatically.

## Adding a new schema version

1. Add an entry to `src/schemas.config.ts`:
   ```ts
   { label: '18.12', filename: 'gitlab-ci-18.12.json', ref: 'v18.12.0-ee' }
   ```
2. Push to `main`. The cache key changes (because the file's hash changes), `fetch-schemas` downloads the new file, and the deploy publishes it.

## Local development

Node.js is **not** required on the host — use the project's standard container:

```bash
docker run --rm -it -v "$PWD":/app -w /app \
  -p 5173:5173 node:25-alpine3.22 sh
# inside the container (root, so pnpm can install globally):
npm install -g pnpm
pnpm install
pnpm run fetch-schemas   # one-time, downloads schemas into public/schemas/
pnpm run dev -- --host 0.0.0.0
```

Then open `http://localhost:5173/gitlab-ci-validator/`.

| Script              | Purpose                                    |
| ------------------- | ------------------------------------------ |
| `pnpm dev`          | start the Vite dev server                  |
| `pnpm build`        | type-check + production build into `dist/` |
| `pnpm preview`      | serve the built bundle locally             |
| `pnpm test`         | run the Vitest suite once                  |
| `pnpm test:watch`   | watch mode                                 |
| `pnpm lint`         | run ESLint                                 |
| `pnpm lint:fix`     | run ESLint with `--fix`                    |
| `pnpm format`       | run Prettier with `--write`                |
| `pnpm format:check` | check formatting without writing           |

## Project layout

See `docs/STRUCTURE.md` for the full file tree and `docs/CI.md` for workflow details. Internal architecture is documented under `docs/`.
