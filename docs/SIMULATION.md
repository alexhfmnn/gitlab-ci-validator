# SIMULATION.md

Detailed specification for the simulation engine. Implemented in `src/lib/`.

---

## Trigger Variable Contexts

For each supported trigger type the simulator builds a `VariableContext` from the
predefined CI variables listed below (sourced from the GitLab predefined-variables
docs). Values that cannot be known client-side — SHAs, protected-ref status,
real branch creation history — are emitted as fixed placeholders so rule
evaluation against them is deterministic. Any variable shown as `(absent)` is
**not** present in the `VariableContext` map at all (per the merge rules in
`triggerContexts.ts`, not set to empty string).

There are eight supported trigger types, matching the `TriggerType` enum in
`docs/DATAMODEL.md`: `push`, `tag_push`, `merge_request`, `branch_creation`,
`schedule`, `web`, `api`, `trigger`.

---

#### `push` — Push event to an existing branch

User inputs: `branchName` (defaults to `defaultBranch`)

```
CI_PIPELINE_SOURCE        = push
CI_COMMIT_BRANCH          = <branchName>
CI_COMMIT_REF_NAME        = <branchName>
CI_COMMIT_REF_SLUG        = <slugified branchName>
CI_DEFAULT_BRANCH         = <defaultBranch>
CI_COMMIT_BEFORE_SHA      = (placeholder) 0000000000000000000000000000000000000000
CI_COMMIT_SHA             = (placeholder) 0000000000000000000000000000000000000000
CI_COMMIT_SHORT_SHA       = 00000000
CI_COMMIT_REF_PROTECTED   = false
CI_COMMIT_TAG             = (absent)
```

---

#### `tag_push` — Tag push

User inputs: `tagName`

GitLab uses `CI_PIPELINE_SOURCE=push` for tag pushes (there is no dedicated
`tag` source). `CI_COMMIT_BRANCH` is unset on tag pipelines.

```
CI_PIPELINE_SOURCE        = push
CI_COMMIT_TAG             = <tagName>
CI_COMMIT_REF_NAME        = <tagName>
CI_COMMIT_REF_SLUG        = <slugified tagName>
CI_DEFAULT_BRANCH         = <defaultBranch>
CI_COMMIT_BEFORE_SHA      = 0000000000000000000000000000000000000000
CI_COMMIT_SHA             = (placeholder) 0000000000000000000000000000000000000000
CI_COMMIT_SHORT_SHA       = 00000000
CI_COMMIT_REF_PROTECTED   = false
CI_COMMIT_BRANCH          = (absent)
```

---

#### `merge_request` — Merge request event

User inputs: `mrSourceBranch`, `mrTargetBranch` (defaults to `defaultBranch`),
`mrIsDraft`

`CI_COMMIT_BRANCH` and `CI_COMMIT_TAG` are unset on MR pipelines (detached MR
pipeline behaviour, which is the only mode the simulator models). Draft state
is conveyed via `CI_MERGE_REQUEST_TITLE` — GitLab prefixes draft MR titles with
`Draft:`, which is the canonical signal `rules: if:` expressions match against
(`$CI_MERGE_REQUEST_TITLE =~ /^Draft:/`).

```
CI_PIPELINE_SOURCE                       = merge_request_event
CI_MERGE_REQUEST_SOURCE_BRANCH_NAME      = <mrSourceBranch>
CI_MERGE_REQUEST_TARGET_BRANCH_NAME      = <mrTargetBranch>
CI_MERGE_REQUEST_TITLE                   = "Draft: simulated MR"   (when mrIsDraft = true)
                                         = "simulated MR"          (when mrIsDraft = false)
CI_COMMIT_REF_NAME                       = <mrSourceBranch>
CI_COMMIT_REF_SLUG                       = <slugified mrSourceBranch>
CI_COMMIT_SHA                            = (placeholder) 0000000000000000000000000000000000000000
CI_COMMIT_SHORT_SHA                      = 00000000
CI_DEFAULT_BRANCH                        = <defaultBranch>
CI_COMMIT_BRANCH                         = (absent)
CI_COMMIT_TAG                            = (absent)
```

---

#### `branch_creation` — First push to a new branch

User inputs: `branchName`

Identical to `push` except `CI_COMMIT_BEFORE_SHA` is emitted as the all-zero
SHA literally — this is the signal GitLab itself uses to indicate the branch
did not previously exist, and rule expressions like
`$CI_COMMIT_BEFORE_SHA == "0000000000000000000000000000000000000000"` rely on
it. (For `push` the all-zero SHA is a placeholder; here it carries semantic
weight.)

```
CI_PIPELINE_SOURCE        = push
CI_COMMIT_BRANCH          = <branchName>
CI_COMMIT_REF_NAME        = <branchName>
CI_COMMIT_REF_SLUG        = <slugified branchName>
CI_DEFAULT_BRANCH         = <defaultBranch>
CI_COMMIT_BEFORE_SHA      = 0000000000000000000000000000000000000000   (semantic — branch is new)
CI_COMMIT_SHA             = (placeholder) 0000000000000000000000000000000000000000
CI_COMMIT_SHORT_SHA       = 00000000
CI_COMMIT_REF_PROTECTED   = false
CI_COMMIT_TAG             = (absent)
```

---

#### `schedule` — Scheduled pipeline

User inputs: `branchName` (defaults to `defaultBranch`), `scheduleDescription` (optional free text)

```
CI_PIPELINE_SOURCE                  = schedule
CI_COMMIT_BRANCH                    = <branchName>
CI_COMMIT_REF_NAME                  = <branchName>
CI_COMMIT_REF_SLUG                  = <slugified branchName>
CI_DEFAULT_BRANCH                   = <defaultBranch>
CI_COMMIT_BEFORE_SHA                = 0000000000000000000000000000000000000000
CI_COMMIT_SHA                       = (placeholder) 0000000000000000000000000000000000000000
CI_COMMIT_SHORT_SHA                 = 00000000
CI_COMMIT_REF_PROTECTED             = false
CI_COMMIT_TAG                       = (absent)
CI_PIPELINE_SCHEDULE_DESCRIPTION    = <scheduleDescription>  (absent if left empty)
```

---

#### `web` — Manual pipeline (triggered from the GitLab UI)

User inputs: `branchName` (defaults to `defaultBranch`)

```
CI_PIPELINE_SOURCE        = web
CI_COMMIT_BRANCH          = <branchName>
CI_COMMIT_REF_NAME        = <branchName>
CI_COMMIT_REF_SLUG        = <slugified branchName>
CI_DEFAULT_BRANCH         = <defaultBranch>
CI_COMMIT_BEFORE_SHA      = 0000000000000000000000000000000000000000
CI_COMMIT_SHA             = (placeholder) 0000000000000000000000000000000000000000
CI_COMMIT_SHORT_SHA       = 00000000
CI_COMMIT_REF_PROTECTED   = false
CI_COMMIT_TAG             = (absent)
```

---

#### `api` — Pipeline triggered via the Pipelines API

User inputs: `branchName` (defaults to `defaultBranch`)

```
CI_PIPELINE_SOURCE        = api
CI_COMMIT_BRANCH          = <branchName>
CI_COMMIT_REF_NAME        = <branchName>
CI_COMMIT_REF_SLUG        = <slugified branchName>
CI_DEFAULT_BRANCH         = <defaultBranch>
CI_COMMIT_BEFORE_SHA      = 0000000000000000000000000000000000000000
CI_COMMIT_SHA             = (placeholder) 0000000000000000000000000000000000000000
CI_COMMIT_SHORT_SHA       = 00000000
CI_COMMIT_REF_PROTECTED   = false
CI_COMMIT_TAG             = (absent)
```

---

#### `trigger` — Pipeline triggered via a trigger token

User inputs: `branchName` (defaults to `defaultBranch`)

```
CI_PIPELINE_SOURCE        = trigger
CI_PIPELINE_TRIGGERED     = true
CI_COMMIT_BRANCH          = <branchName>
CI_COMMIT_REF_NAME        = <branchName>
CI_COMMIT_REF_SLUG        = <slugified branchName>
CI_DEFAULT_BRANCH         = <defaultBranch>
CI_COMMIT_BEFORE_SHA      = 0000000000000000000000000000000000000000
CI_COMMIT_SHA             = (placeholder) 0000000000000000000000000000000000000000
CI_COMMIT_SHORT_SHA       = 00000000
CI_COMMIT_REF_PROTECTED   = false
CI_COMMIT_TAG             = (absent)
```

Note: `CI_PIPELINE_TRIGGERED` is a Pipeline-phase variable (not Pre-pipeline), so it cannot
be used in `rules: if:` expressions. It is included in the active variables panel for
completeness but the evaluator treats it as absent during rule evaluation.

---

## Entry Point: `simulator.ts`

```ts
export function simulate(
  parsedYaml: Record<string, unknown>,
  triggerType: TriggerType,
  triggerInputs: TriggerInputs,
  customVariables: CustomVariable[],
): SimulationResult;
```

### Steps (in order)

1. **Build variable context** via `triggerContexts.ts`
2. **Evaluate `workflow: rules:`** — if pipeline blocked, return `{ status: 'pipeline_blocked' }`
3. **Detect `include:`** — set `includeDetected` flag if top-level `include:` key exists
4. **Resolve stages** — read `stages:` key; default to `['build', 'test', 'deploy']` if absent
5. **Collect jobs** — all top-level keys that are not reserved (see below)
6. **Filter jobs** via `rulesEvaluator.ts`
7. **Resolve scripts** via `scriptResolver.ts` for each included job
8. **Validate `needs:`** — collect all violations as `NeedsError[]`
9. **Order jobs** by stage index, then by definition order within stage
10. **Return** `{ status: 'complete', jobs, needsErrors, includeDetected, activeVariables }`

### Reserved Top-Level Keys (not treated as jobs)

`stages`, `variables`, `default`, `workflow`, `include`, `image`, `services`, `before_script`, `after_script`, `cache`

---

## Trigger Contexts: `triggerContexts.ts`

```ts
export function buildVariableContext(
  triggerType: TriggerType,
  inputs: TriggerInputs,
  customVariables: CustomVariable[],
): VariableContext;
```

Summary of distinguishing variables per trigger type. See the per-trigger blocks
above for the complete variable set including SHA placeholders and ref metadata.

| Trigger           | Distinguishing variables                                                                                                                                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `push`            | `CI_PIPELINE_SOURCE=push`, `CI_COMMIT_BRANCH=<branchName>`, `CI_DEFAULT_BRANCH=<defaultBranch>`, `CI_COMMIT_TAG` unset                                                                                                                                                                                          |
| `tag_push`        | `CI_PIPELINE_SOURCE=push`, `CI_COMMIT_TAG=<tagName>`, `CI_DEFAULT_BRANCH=<defaultBranch>`, `CI_COMMIT_BRANCH` unset                                                                                                                                                                                             |
| `merge_request`   | `CI_PIPELINE_SOURCE=merge_request_event`, `CI_MERGE_REQUEST_SOURCE_BRANCH_NAME=<mrSourceBranch>`, `CI_MERGE_REQUEST_TARGET_BRANCH_NAME=<mrTargetBranch>`, `CI_MERGE_REQUEST_TITLE` (with `Draft:` prefix iff `mrIsDraft`), `CI_DEFAULT_BRANCH=<defaultBranch>`, `CI_COMMIT_BRANCH` unset, `CI_COMMIT_TAG` unset |
| `branch_creation` | `CI_PIPELINE_SOURCE=push`, `CI_COMMIT_BRANCH=<branchName>`, `CI_COMMIT_BEFORE_SHA=0000…0` (semantic), `CI_DEFAULT_BRANCH=<defaultBranch>`, `CI_COMMIT_TAG` unset                                                                                                                                                |
| `schedule`        | `CI_PIPELINE_SOURCE=schedule`, `CI_COMMIT_BRANCH=<branchName>`, `CI_DEFAULT_BRANCH=<defaultBranch>`, `CI_PIPELINE_SCHEDULE_DESCRIPTION=<scheduleDescription>` (omitted if empty)                                                                                                                                |
| `web`             | `CI_PIPELINE_SOURCE=web`, `CI_COMMIT_BRANCH=<branchName>`, `CI_DEFAULT_BRANCH=<defaultBranch>`                                                                                                                                                                                                                  |
| `api`             | `CI_PIPELINE_SOURCE=api`, `CI_COMMIT_BRANCH=<branchName>`, `CI_DEFAULT_BRANCH=<defaultBranch>`                                                                                                                                                                                                                  |
| `trigger`         | `CI_PIPELINE_SOURCE=trigger`, `CI_PIPELINE_TRIGGERED=true` (Pipeline-phase only — see note below), `CI_COMMIT_BRANCH=<branchName>`, `CI_DEFAULT_BRANCH=<defaultBranch>`                                                                                                                                         |

**Merge order**: predefined trigger variables are set first. Custom variables are merged on top, but predefined keys are protected — if a custom variable key matches a predefined key, it is ignored (the UI shows an inline error; the evaluator enforces this by using the predefined value).

**YAML-defined variables** (top-level `variables:`, `default.variables:`, and per-job `variables:`) are also injected into the rule-evaluation context by `simulator.ts`. Precedence (low → high): top-level `variables:` → `default.variables:` → job-level `variables:` → scoped/custom → predefined trigger vars. The job-level layer is applied per-job during job evaluation; pipeline-level YAML vars (top-level + default) are visible to `workflow:rules` and end up in `activeVariables`.

A YAML variable can be either a string (`HAS_FRONTEND: "false"`) or a describable object (`{ value: "INT1", options: [...], description: "..." }`) — for the latter, the simulator reads the `value` field. Numbers and booleans are coerced via `String()`.

"Unset" variables are absent from the `VariableContext` map entirely (not set to empty string).

---

## Rules Evaluator: `rulesEvaluator.ts`

```ts
export function evaluateJobInclusion(
  job: Record<string, unknown>,
  variables: VariableContext,
): JobInclusionResult;

export function evaluateWorkflowRules(
  workflow: Record<string, unknown>,
  variables: VariableContext,
): { blocked: boolean; matchedRule?: string };
```

### Evaluation priority (mirrors GitLab behaviour)

1. If job has `rules:` → evaluate rules (ignore `only:`/`except:`)
2. Else if job has `only:` or `except:` → evaluate legacy syntax
3. Else → job is included with `when: on_success`

### `rules:` evaluation

Iterate rules in order. First matching rule wins.

A rule matches when:

- `if:` is absent **or** `if:` expression evaluates to truthy
- AND `changes:` is absent or treated as `true` (with warning)
- AND `exists:` is absent or treated as `true` (with warning)

On match:

- `when: never` → excluded
- `when: always` | `when: on_success` | absent → included
- `when: manual` → included with manual flag

If no rule matches → job is excluded.

### `if:` expression parser

Sourced from the GitLab docs. Implement exactly as specified below.

**Grammar:**

```
expr           = or_expr
or_expr        = and_expr ( "||" and_expr )*
and_expr       = unary ( "&&" unary )*
unary          = "!" unary | "!" "(" expr ")" | comparison
comparison     = value op value | "(" expr ")"
op             = "==" | "!=" | "=~" | "!~"
value          = variable | string_literal | "null"
variable       = "$" IDENTIFIER
string_literal = '"' [^"]* '"' | "'" [^']* "'"
```

**Operator precedence:** `&&` binds tighter than `||` (Ruby 2.5 standard, confirmed in GitLab docs).

**Variable resolution:**

- `$VAR` → look up in `VariableContext`; if absent → `null`
- `null` literal → JavaScript `null`
- Empty string `""` → falsy
- Non-empty string → truthy

**Truthiness (used for bare variable checks `$VAR`):**

- `null` → falsy
- `""` (empty string) → falsy
- Any non-empty string → truthy
- `!"false"` → `false` (non-empty string is truthy, negated = false)
- `!"0"` → `false` (same reason)
- `!""` → `true` (empty string is falsy, negated = true)

**Operator semantics:**

- `==` → string equality; `null == null` is `true`
- `!=` → string inequality
- `=~` → RE2 regex match. RHS must be a `/pattern/` or `/pattern/flags` literal enclosed in `/`. Variables on the RHS are looked up but **variables inside the regex pattern are not expanded** (GitLab confirmed behaviour). Returns truthy if match found.
- `!~` → negated RE2 regex match

**Regex flags:** only `i` (case-insensitive) is supported in RE2. Example: `/^release/i`

**Variables in regex patterns:** if the RHS is a variable containing a `/pattern/` string, it is used as-is as the pattern (the variable value is the regex, not expanded further).

If the expression cannot be parsed (unsupported syntax, malformed regex, etc.):
→ return `{ matched: true, warning: "Expression could not be evaluated: <raw expr>" }`

### `only:`/`except:` evaluation (legacy)

Both plain array and `refs:` object syntax are treated identically:

```yaml
only: [master]          # equivalent
only:
  refs: [master]        # equivalent
```

**Multi-key AND semantics** (confirmed in GitLab docs):

- `only:` includes the job if **all** specified keys match (AND between keys, OR within each key's list)
- `except:` excludes the job if **any** specified key matches

Example:

```yaml
only:
  refs: [master, schedules] # (branch is master OR source is schedule)
  variables: [$MY_VAR == "x"] # AND (variable condition is true)
```

**`refs:` keyword matching** against trigger context:

| Keyword          | Matches when                                  |
| ---------------- | --------------------------------------------- |
| `branches`       | `CI_COMMIT_BRANCH` is set                     |
| `tags`           | `CI_COMMIT_TAG` is set                        |
| `merge_requests` | `CI_PIPELINE_SOURCE == "merge_request_event"` |
| `pushes`         | `CI_PIPELINE_SOURCE == "push"`                |
| `schedules`      | `CI_PIPELINE_SOURCE == "schedule"`            |
| `web`            | `CI_PIPELINE_SOURCE == "web"`                 |
| `api`            | `CI_PIPELINE_SOURCE == "api"`                 |
| `triggers`       | `CI_PIPELINE_SOURCE == "trigger"`             |

Bare strings that are not keywords are treated as ref patterns (regex) matched against `CI_COMMIT_BRANCH` or `CI_COMMIT_TAG`.

**`only: variables:`** — each entry is an expression string evaluated using the same `if:` expression parser. OR semantics within the list. Combined with `refs:` using AND.

**`only: kubernetes:`** — not evaluatable client-side; treated as `true` (conservative) with a per-job warning.

---

## Script Resolver: `scriptResolver.ts`

```ts
export function resolveScripts(
  job: Record<string, unknown>,
  globalDefault: Record<string, unknown> | undefined,
): ResolvedScripts;
```

### Inheritance rules (mirrors GitLab behaviour)

| Field           | Resolution                                                               |
| --------------- | ------------------------------------------------------------------------ |
| `before_script` | Job-level if present, else `default.before_script` if present, else `[]` |
| `script`        | Always job-level (required field, validated by schema)                   |
| `after_script`  | Job-level if present, else `default.after_script` if present, else `[]`  |

All script values normalised to `string[]`. A bare string becomes a single-element array.

---

## `needs:` Validation

After job filtering, for each included job with a `needs:` key:

- `needs:` may be an array of strings or an array of objects with a `job:` field and optional `optional: true`
- For each referenced job name:
  - If the job is in the included set → OK
  - If the job is **not** in the included set AND `optional: true` → skip silently (valid GitLab behaviour)
  - If the job is **not** in the included set AND no `optional: true` → add a `NeedsError { job, missingDependency }`

All `NeedsError` entries are collected and returned in `SimulationResult`. The presence of `needsErrors` does not prevent the job table from rendering — both are shown.

---

## Pagination

The simulation result table paginates by stage:

- 5 stages per page
- Stages with no included jobs are skipped entirely
- Page state lives in `App.tsx` as `paginationPage: number` (0-indexed)
- Resets to 0 whenever a new simulation result is set
