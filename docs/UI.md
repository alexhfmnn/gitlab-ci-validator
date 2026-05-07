# UI.md

Component behaviour specification. See `DATAMODEL.md` for prop types.

---

## Layout

Single page, top to bottom, no routing. All components rendered in `App.tsx`.

```
<VersionUpdateBanner />     ← only when a newer GitLab schema version is available
<PipelineSettings />        ← GitLab version + default-branch selectors
<Header />
<CICDVariablesPanel>
  <TriggerSelector />       ← rendered inside the panel header row
  <ValidateButton />        ← rendered inside the panel header row
</CICDVariablesPanel>
<YamlEditor />
<ValidationResult />        ← always rendered, hidden when status is 'idle'
<SimulationBanner />        ← only on validation success — describes the simulated trigger context
<NeedsErrorBanner />        ← only when simResult.status === 'complete' && needsErrors.length > 0
<SimulationResult />        ← only when simResult.status === 'complete' or 'pipeline_blocked'
<ActiveVariablesPanel />    ← only when simResult.status === 'complete'
<Footer />
```

Validation and simulation are coupled: clicking `Validate` runs validation and, on success,
immediately runs the simulation. There is no separate `Simulate` button.

---

## Header

- Title: `GitLab CI Validator & Simulator`
- Subtitle: `Validate and simulate your .gitlab-ci.yml locally — no API calls required.`

---

## Footer

- Left: link to GitHub repo (`https://github.com/<username>/gitlab-ci-validator`)
- Right: `Schemas: 17.11, 18.0 – 18.11` (derived from `SCHEMA_VERSIONS`)

---

## VersionUpdateBanner

Rendered above the page header when:

- `localStorage['gcv:settings:gitlabVersion']` is set, **and**
- it does not match the latest entry in `SCHEMA_VERSIONS`, **and**
- `localStorage['gcv:dismissed:versionWarning']` does not match that latest version.

Two actions:

- **Switch to <latest>** — updates the selected version to latest and hides the banner.
- **Dismiss version update** — writes the latest version into `gcv:dismissed:versionWarning`
  so the banner stays hidden until an even newer version is published.

---

## PipelineSettings

Two adjacent selectors above the editor:

- **GitLab version** — dropdown over `SCHEMA_VERSIONS` (newest first), default
  `DEFAULT_SCHEMA_VERSION`. Persisted to `gcv:settings:gitlabVersion`. Changing
  version clears `validationResult` and `simulationResult`.
- **Default branch** — dropdown of `main` (default), `master`, `develop`, plus a free
  text input for anything else. Persisted to `gcv:settings:defaultBranch`. Used as the
  initial value of branch fields in `TriggerSelector`.

---

## YamlEditor

- CodeMirror 6 instance via `@uiw/react-codemirror`
- Language: YAML (`@codemirror/lang-yaml`)
- Theme: light when `prefers-color-scheme: light`, dark when dark
- Height: 500px fixed, internal scroll
- Line numbers: visible
- On change: updates `yaml` in App state and persists to `sessionStorage['gcv:yaml']`
- Accepts `target: EditorTarget | null` prop
  - When non-null: scroll to line, place cursor at start of line, focus editor
  - Calls `onTargetApplied()` to reset `target` to null in App after navigation (one-shot)

---

## ValidateButton

- Label: `Validate`
- Disabled while a previous validation is still resolving (`busy` prop)
- On click:
  1. If `yaml` is empty or whitespace → set `validationResult = { status: 'empty' }`
  2. Else → run `validator.ts`, set result
  3. If result is `valid` → immediately run simulation and set `simulationResult`
  4. If result is `invalid` or `yaml_error` → clear any previous `simulationResult`

---

## ValidationResult

Hidden when `status === 'idle'`.

| Status       | Display                                                   |
| ------------ | --------------------------------------------------------- |
| `empty`      | Inline error: `Please enter a .gitlab-ci.yml.`            |
| `yaml_error` | Red banner: `YAML parse error: <message>`                 |
| `invalid`    | Red banner: `Validation failed`, then flat list of errors |
| `valid`      | Green banner: `Pipeline syntax is valid`                  |

Each error in the flat list:

- Format: `<path>: <message>` with line number suffix if available: `(line 12)`
- Entire row is a clickable button → sets `editorTarget` in App to navigate the editor.
  The button is disabled when no line could be resolved.

Validation result is **not** cleared when YAML is edited afterward.

---

## SimulationBanner

Rendered only when `validationResult.status === 'valid'` and a simulation has run.
Single-line `<output>` element summarising the trigger context that was simulated, e.g.:

```
Simulated as: push event on main · Rules, only, except, and needs job dependencies logic have been evaluated.
```

The banner content updates whenever the simulation result changes.

---

## TriggerSelector

Rendered inside the `CICDVariablesPanel` header row alongside `ValidateButton`.

### Trigger type dropdown

Options (in order):

1. Push event
2. Tag push
3. Merge request
4. Branch creation
5. Scheduled pipeline
6. Manual (web)
7. API
8. Trigger token

Default: `Push event`

### Dynamic fields per trigger type

**Push event**

- `Branch name` — text input, required, defaults to value of Default branch (from PipelineSettings)

**Tag push**

- `Tag name` — text input, required, e.g. `v1.0.0`

**Merge request**

- `Source branch` — text input, required
- `Target branch` — text input, required, defaults to Default branch
- `Draft` — checkbox, label: `Draft MR`, default unchecked

**Branch creation**

- `Branch name` — text input, required

**Scheduled pipeline**

- `Branch name` — text input, required, defaults to Default branch
- `Schedule description` — text input, optional, sets `CI_PIPELINE_SCHEDULE_DESCRIPTION`

**Manual (web) / API / Trigger token**

- `Ref kind` — choice between branch and tag (`refKind: 'branch' | 'tag'`)
- `Branch name` *or* `Tag name` (depending on `refKind`) — required, branch defaults to Default branch

---

## CICDVariablesPanel

Container for all user-supplied CI/CD variables. Splits its body into two sections:

### Scoped (persisted)

- Heading: `Scoped`
- Persisted to `localStorage['gcv:variables:scoped']` so they survive reloads
- Intended for stable per-machine values (tokens, account IDs, etc.)

### Custom (in-memory)

- Heading: `Custom`
- In-memory only — cleared on reload
- Intended for one-off experiments

### Each row (both sections)

- `KEY` text input — uppercase convention, not enforced
- `VALUE` text input
- `×` remove button
- `+ Add variable` button below each section, disabled at the per-section limit (20 entries)

### Inline messages (shown below the KEY input)

- **Duplicate key**: `Duplicate key` — shown as an error, blocks simulation
- **Predefined variable override**: `Note: This overrides the predefined variable set by the trigger context.` — informational only, does not block simulation

Predefined trigger variables always take precedence — if a user sets `CI_COMMIT_BRANCH`,
the trigger value still wins, and the override note is shown.

---

## ActiveVariablesPanel

Only rendered when `simulationResult.status === 'complete'`.
Collapsed by default, toggled by header: `Active CI variables`.

Displays all key-value pairs from `activeVariables` as a two-column table:

```
CI_PIPELINE_SOURCE   push
CI_COMMIT_BRANCH     main
CI_DEFAULT_BRANCH    main
MY_VAR               foo
```

---

## NeedsErrorBanner

Only rendered when `simulationResult.status === 'complete'` and `needsErrors.length > 0`.
Red banner shown above the job table.

Content:

```
Pipeline simulation completed with errors
```

Followed by one line per error:

```
'<job>' needs '<dependency>', but it was not added to the pipeline
```

---

## SimulationResult

Rendered when `simulationResult.status` is `complete` or `pipeline_blocked`.

### `include:` warning

If `includeDetected === true`, show a yellow banner at the top:

```
⚠ include: detected — jobs from included files are not shown
```

### `workflow: rules:` blocked

When `simulationResult.status === 'pipeline_blocked'`:

```
🔴 Pipeline would not run — blocked by workflow: rules:
   Matched rule: <matchedRule>
```

No job table rendered.

### Job table (when not blocked)

Paginated: 5 stages per page. Stages with no included jobs are skipped.

Pagination controls (shown when `totalPages > 1`):

```
[ ← ]   Page 2 / 4   [ → ]
```

Per stage: section header with stage name.

Per job row (two columns):

**Left column**: job name

- `[manual]` badge if `when === 'manual'`
- `[tags: ...]` badge if `tags.length > 0`
- Warning indicator if `warnings.length > 0`: clickable `⚠` icon that expands/collapses the warnings list below the badge

**Right column**: scripts (expanded by default, collapsible)

```
▲ Hide scripts

before_script:
  echo setup

script:
  echo build
  echo test

after_script:
  echo done
```

Toggle label: `▲ Hide scripts` / `▼ Show scripts`

Script content: plain monospace text block. If a section (`before_script` or `after_script`) is an empty array, it is not rendered.

**Warnings list** (under left column, expanded when ⚠ is clicked):

```
• changes: clause treated as true (cannot evaluate without repository context)
• Expression could not be evaluated: $CI_COMMIT_MESSAGE =~ /hotfix/
```

---

## State Reset Rules

| Action                                | Clears                                                    |
| ------------------------------------- | --------------------------------------------------------- |
| Change schema version                 | `validationResult`, `simulationResult`                    |
| Change default branch                 | Nothing (only updates persisted setting + form defaults)  |
| Edit YAML                             | Nothing                                                   |
| Click Validate (empty)                | Sets `validationResult = { status: 'empty' }`             |
| Click Validate (valid)                | Sets `validationResult`, runs simulation                  |
| Click Validate (invalid / yaml_error) | Sets `validationResult`, clears `simulationResult`        |
| Change trigger type                   | Nothing (custom + scoped variables persist)               |
| Change trigger fields                 | Nothing                                                   |
| Click an error row in ValidationResult| Sets `editorTarget`; YamlEditor jumps and clears it again |
