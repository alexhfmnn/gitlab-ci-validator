# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GitLab CI Validator & Simulator** — a static GitHub Pages app that validates `.gitlab-ci.yml` files against bundled GitLab CI JSON Schemas (mirroring GitLab's own pipeline-editor "Validate" function) and simulates pipeline runs locally for multiple trigger types. No API calls. No backend.

**Canonical names** — use these consistently across code, docs, and config:

- Project / GitHub repo: `gitlab-ci-validator`
- Vite `base` and GitHub Pages path: `/gitlab-ci-validator/`
- Display title in UI: `GitLab CI Validator & Simulator`

## Current State

The repository is **spec-only** at the moment — only `CLAUDE.md` and `docs/` exist. No `package.json`, `src/`, `scripts/`, or `.github/workflows/` yet. The first implementation task must scaffold these from `docs/STRUCTURE.md`, `docs/DATAMODEL.md`, `docs/UI.md`, `docs/CI.md`, and `docs/SIMULATION.md`.

## Trigger Types

Eight supported triggers, each automatically setting the correct predefined CI variables (sourced from https://docs.gitlab.com/ci/variables/predefined_variables/). Full variable sets defined in `docs/SIMULATION.md`.

| Trigger            | User inputs                                  |
| ------------------ | -------------------------------------------- |
| Push event         | Branch name                                  |
| Tag push           | Tag name                                     |
| Merge request      | Source branch, target branch, draft checkbox |
| Branch creation    | Branch name                                  |
| Scheduled pipeline | Branch name, schedule description (optional) |
| Manual (web)       | Branch name                                  |
| API                | Branch name                                  |
| Trigger token      | Branch name                                  |

## Tech Stack

- **Framework**: React + Vite
- **Language**: TypeScript (strict)
- **YAML parsing**: `js-yaml`
- **YAML editor**: CodeMirror (YAML syntax highlighting, line numbers, 500px fixed height, light/dark theme)
- **Schema validation**: `ajv` (JSON Schema Draft-07)
- **Styling**: Plain CSS only — no UI framework, no Tailwind, no CSS-in-JS
- **Testing**: Vitest
- **Deployment**: GitHub Actions → `gh-pages` branch
- **Base URL**: `/gitlab-ci-validator/` (set in `vite.config.ts`)

## Repository Structure

See `docs/STRUCTURE.md` for the full file tree.

## Documentation Index

When investigating behaviour, jump straight to the right reference:

| File                 | Covers                                                                 |
| -------------------- | ---------------------------------------------------------------------- |
| `docs/STRUCTURE.md`  | Full file tree, key file responsibilities                              |
| `docs/DATAMODEL.md`  | All TypeScript types, App state shape, prop contracts                  |
| `docs/UI.md`         | Component layout, behaviour, state-reset rules                         |
| `docs/SIMULATION.md` | Simulation engine, `if:` expression grammar, trigger variable contexts |
| `docs/CI.md`         | GitHub Actions workflows, schema fetch script, Vite config             |

## Key Constraints

- **No API calls** — everything runs client-side
- **localStorage** is allowed for persisted scoped CI/CD variables (`gcv:variables:scoped`), the selected GitLab schema version (`gcv:settings:gitlabVersion`), the selected default branch (`gcv:settings:defaultBranch`), and the dismissed-version-warning marker (`gcv:dismissed:versionWarning`). The YAML draft is persisted in `sessionStorage` under `gcv:yaml`. All other state stays in memory and resets on reload.
- **No UI framework** — plain CSS only
- **No live validation** — validate only on explicit button click
- **Schemas are fetched at build time** by `scripts/fetch-schemas.ts`, which runs in GitHub Actions only (not locally)
- **Strict build**: any schema fetch failure (missing tag, network error, 404) fails the build immediately
- **No README**

## Commands

```bash
pnpm dev           # local development (schemas must already exist in public/schemas/)
pnpm build         # production build
pnpm test          # run Vitest
pnpm preview       # preview production build locally
pnpm lint          # run ESLint
pnpm format        # run Prettier
pnpm format:check  # verify formatting without writing
```

**Node.js is NOT installed on the host.** Run every node invocation inside the
`node:25-alpine3.22` container. The container does not ship pnpm — install it as
root once per session, then run commands as your user via `./node_modules/.bin/<cmd>`:

```bash
# One-time install of pnpm + dependencies (runs as root so pnpm install -g works,
# then chowns the lockfile + node_modules back to your user)
docker run --rm -v "$PWD":/app -w /app node:25-alpine3.22 sh -c '
  npm install -g pnpm &&
  pnpm install &&
  chown -R '"$(id -u):$(id -g)"' /app/node_modules /app/pnpm-lock.yaml'

# Subsequent commands as your user, calling local binaries directly
docker run --rm -v "$PWD":/app -w /app -u "$(id -u):$(id -g)" \
  node:25-alpine3.22 ./node_modules/.bin/vitest run

docker run --rm -v "$PWD":/app -w /app -u "$(id -u):$(id -g)" \
  node:25-alpine3.22 ./node_modules/.bin/tsc -b

# Dev server — also publish the Vite port
docker run --rm -it -v "$PWD":/app -w /app -u "$(id -u):$(id -g)" \
  -p 5173:5173 node:25-alpine3.22 ./node_modules/.bin/vite --host 0.0.0.0
```

CI uses the standard `actions/setup-node@v4` runner — see `docs/CI.md`. The container
above is for local development and test runs only.

## Decision Protocol

For any ambiguous or technically specific behaviour — especially around GitLab CI evaluation rules, predefined variables, keyword semantics, or pipeline logic — **always consult the GitLab documentation first** before asking. Use web search and web_fetch against:

- https://docs.gitlab.com/ci/variables/predefined_variables/
- https://docs.gitlab.com/ci/jobs/job_rules/
- https://docs.gitlab.com/ci/yaml/
- https://docs.gitlab.com/ci/yaml/workflow/

Only ask when the answer cannot be found in the docs (e.g. purely subjective UX preferences, project-specific constraints, or intentional design choices that the docs cannot answer).

## Adding a New Schema Version

1. Add one entry to `src/schemas.config.ts` with the display label, filename, and GitLab ref tag.
2. Push to `main` — GitHub Actions fetches the schema and deploys.

## Coding Conventions

- All source files in `src/`, all tests in `src/__tests__/`
- Components in `src/components/`, pure logic in `src/lib/`
- No default exports from `lib/` modules — named exports only
- CSS files co-located with components (e.g. `YamlEditor.css` next to `YamlEditor.tsx`)
- No inline styles

## Agent Behaviour Rules

1. **Plan before building** — enter plan mode for any non-trivial task (3+ steps or architectural decisions). If something goes sideways, stop and re-plan.
2. **Task management** — write plans to `tasks/todo.md`, track progress, capture lessons in `tasks/lessons.md` after any correction.
3. **Verify before done** — never mark a task complete without proving it works. Ask: "Would a staff engineer approve this?"
4. **Simplicity first** — make every change as simple as possible. Find root causes, no temporary fixes.
5. **Autonomous bug fixing** — given a bug report, just fix it. Point at logs/errors/tests, then resolve.
6. **Documentation** - always document changes in the markdown files for future sessions without context.

## AI Model Selection

- **Plan mode** (architecture, specs, open questions): `claude-sonnet-4-6`
- **Coding mode** (implementation, scaffolding, bug fixing): `claude-opus-4-7`
