# STRUCTURE.md

## Full File Tree

```
gitlab-ci-validator/
├── public/
│   └── schemas/                         # populated by scripts/fetch-schemas.ts in CI
│       ├── gitlab-ci-17.11.json
│       ├── gitlab-ci-18.0.json
│       ├── gitlab-ci-18.1.json
│       ├── gitlab-ci-18.2.json
│       ├── gitlab-ci-18.3.json
│       ├── gitlab-ci-18.4.json
│       ├── gitlab-ci-18.5.json
│       ├── gitlab-ci-18.6.json
│       ├── gitlab-ci-18.7.json
│       ├── gitlab-ci-18.8.json
│       ├── gitlab-ci-18.9.json
│       ├── gitlab-ci-18.10.json
│       └── gitlab-ci-18.11.json
│
├── scripts/
│   └── fetch-schemas.ts                 # downloads schemas from GitLab at build time (CI only)
│
├── src/
│   ├── schemas.config.ts                # single source of truth: version label → filename + GitLab ref
│   ├── types.ts                         # all shared TypeScript types (see DATAMODEL.md)
│   ├── App.tsx                          # root component, owns all top-level state
│   ├── App.css
│   ├── main.tsx                         # Vite entry point
│   ├── index.css
│   ├── vite-env.d.ts
│   │
│   ├── components/
│   │   ├── Header.tsx                   # title + short description
│   │   ├── Header.css
│   │   ├── Footer.tsx                   # GitHub repo link + schema version list
│   │   ├── Footer.css
│   │   ├── PipelineSettings.tsx         # GitLab version + default-branch selectors
│   │   ├── PipelineSettings.css
│   │   ├── VersionUpdateBanner.tsx      # banner shown when newer GitLab schema is available
│   │   ├── VersionUpdateBanner.css
│   │   ├── YamlEditor.tsx               # CodeMirror wrapper
│   │   ├── YamlEditor.css
│   │   ├── ValidateButton.tsx
│   │   ├── ValidateButton.css
│   │   ├── ValidationResult.tsx         # valid banner or flat clickable error list
│   │   ├── ValidationResult.css
│   │   ├── SimulationBanner.tsx         # post-validation summary describing trigger context
│   │   ├── SimulationBanner.css
│   │   ├── TriggerSelector.tsx          # trigger type dropdown + dynamic context fields
│   │   ├── TriggerSelector.css
│   │   ├── CICDVariablesPanel.tsx       # scoped (persisted) + custom variable inputs
│   │   ├── CICDVariablesPanel.css
│   │   ├── ActiveVariablesPanel.tsx     # collapsible resolved CI variables for trigger context
│   │   ├── ActiveVariablesPanel.css
│   │   ├── NeedsErrorBanner.tsx         # all needs: dependency errors shown before job table
│   │   ├── NeedsErrorBanner.css
│   │   ├── SimulationResult.tsx         # orchestrates simulation output
│   │   └── SimulationResult.css
│   │
│   └── lib/
│       ├── validator.ts                 # AJV-based schema validation
│       ├── semanticValidator.ts         # post-AJV semantic checks (unknown keys, etc.)
│       ├── normalizePipeline.ts         # YAML → normalized pipeline object
│       ├── simulator.ts                 # orchestrates full simulation pipeline
│       ├── triggerContexts.ts           # maps trigger type + user inputs → CI variable set
│       ├── rulesEvaluator.ts            # evaluates rules:/only:/except: against variable context
│       ├── scriptResolver.ts            # resolves before_script/script/after_script per job
│       ├── scopedVarStorage.ts          # localStorage / sessionStorage helpers
│       └── typeGuards.ts                # shared type predicates and error-message helpers
│
├── src/__tests__/
│   ├── setup.ts                         # Vitest setup (jest-dom, storage stubs)
│   ├── lib/
│   │   ├── normalizePipeline.test.ts
│   │   ├── rulesEvaluator.test.ts
│   │   ├── scopedVarStorage.test.ts
│   │   ├── scriptResolver.test.ts
│   │   ├── semanticValidator.test.ts
│   │   ├── simulator.test.ts
│   │   ├── triggerContexts.test.ts
│   │   ├── typeGuards.test.ts
│   │   └── validator.test.ts
│   └── components/
│       ├── App.test.tsx
│       ├── CICDVariablesPanel.test.tsx
│       ├── MiscComponents.test.tsx
│       ├── PipelineSettings.test.tsx
│       ├── TriggerSelector.test.tsx
│       ├── ValidateButton.test.tsx
│       ├── ValidationResult.test.tsx
│       ├── VersionUpdateBanner.test.tsx
│       └── YamlEditor.test.tsx
│
├── .github/
│   ├── dependabot.yml
│   └── workflows/
│       ├── ci.yml                       # lint + format + type check + tests + build on every push/PR
│       ├── codeql.yml                   # weekly + per-PR CodeQL security analysis
│       └── deploy.yml                   # fetch schemas + build + deploy on push to main
│
├── tasks/                               # agent scratch dir — `todo.md`, `lessons.md`
│
├── CLAUDE.md                            # project instructions for Claude Code
├── README.md
├── LICENSE                              # MIT
├── docker-compose.yml                   # local SonarQube stack
├── sonar-project.properties             # SonarQube scanner config (sources, tests, coverage paths)
├── eslint.config.js                     # flat ESLint config (typescript-eslint strictTypeChecked)
├── .prettierrc.json
├── .prettierignore
├── .gitignore
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Key File Responsibilities

### `src/schemas.config.ts`

Single source of truth for all bundled schema versions. Each entry contains:

- `label`: display name shown in the version dropdown (e.g. `"18.11"`)
- `filename`: file in `public/schemas/` (e.g. `"gitlab-ci-18.11.json"`)
- `ref`: exact GitLab tag used to fetch it (e.g. `"v18.11.0-ee"`)

Also exports `DEFAULT_SCHEMA_VERSION`.

### `scripts/fetch-schemas.ts`

Reads `SCHEMA_VERSIONS` from `schemas.config.ts`, downloads each schema from:
`https://gitlab.com/gitlab-org/gitlab/-/raw/{ref}/app/assets/javascripts/editor/schema/ci.json`
Writes to `public/schemas/{filename}`. Skips files already present (cache hit). Fails immediately on any error (missing tag, 404, network failure).
Runs in GitHub Actions only — not intended for local use.

### `src/lib/validator.ts`

AJV-based schema validation. Loads the compiled schema for the selected version, runs it against the normalized pipeline, formats AJV errors (resolving line numbers where possible), and merges in semantic errors from `semanticValidator.ts`.

### `src/lib/semanticValidator.ts`

Post-AJV checks that the JSON Schema cannot express on its own (e.g. unknown keys under reserved top-level sections, ref-to-undefined-stage, etc.). Returns the same `ValidationError` shape so results can be merged with AJV output.

### `src/lib/normalizePipeline.ts`

Normalizes the parsed YAML into a stable `Record<string, unknown>` shape used by both the validator and the simulator. Handles edge cases like top-level lists or scalars.

### `src/lib/rulesEvaluator.ts`

Most complex module. Evaluates `rules:`, `only:`, `except:`, and `workflow: rules:` against a variable map.
Supported `if:` operators: `==`, `!=`, `=~` (regex), `!~`, `&&`, `||`, null checks.
Unevaluatable expressions and `changes:`/`exists:` clauses are treated as `true` (conservative) and return a warning string alongside the result.

### `src/lib/triggerContexts.ts`

Maps a trigger type enum + user-supplied input fields to a `Record<string, string>` of predefined CI variables. Custom variables are merged on top by the caller, with predefined variables taking precedence.

### `src/lib/scriptResolver.ts`

Resolves the effective `before_script`, `script`, and `after_script` for a job by applying GitLab's inheritance rules: job-level overrides `default`, which overrides nothing.

### `src/lib/scopedVarStorage.ts`

Thin wrappers around `localStorage` / `sessionStorage` for the persisted state listed in `CLAUDE.md`:
`gcv:variables:scoped`, `gcv:settings:gitlabVersion`, `gcv:settings:defaultBranch`,
`gcv:dismissed:versionWarning`, and the in-flight YAML draft `gcv:yaml`.

### `src/lib/typeGuards.ts`

Shared `isPlainObject` / `errorMessage` helpers used across validator, simulator, and rules evaluator. No runtime dependencies.

### `src/App.tsx`

Owns all application state:

- YAML string (persisted in `sessionStorage`)
- selected schema version + default branch (persisted in `localStorage`)
- validation result
- trigger type + trigger input fields
- scoped (persisted) + custom (in-memory) variables
- simulation result
- editor target (one-shot navigation signal)

Passes state and callbacks down to components as props. No global state management library.

### `sonar-project.properties`

SonarQube scanner config. Points `sonar.sources=src,scripts` and `sonar.tests=src/__tests__`,
excludes the test tree from main sources to avoid double-indexing, and wires Vitest's
`coverage/lcov.info` into both the `javascript` and `typescript` LCOV report paths.
