# DATAMODEL.md

All TypeScript types used across the application. No runtime state management library — all state lives in `App.tsx` and is passed via props.

---

## schemas.config.ts

```ts
export interface SchemaVersion {
  label: string; // e.g. "18.11" — shown in dropdown
  filename: string; // e.g. "gitlab-ci-18.11.json" — served from /schemas/
  ref: string; // e.g. "v18.11.0-ee" — GitLab tag used to fetch schema
}

export const SCHEMA_VERSIONS = [
  /* ... */
] as const satisfies readonly SchemaVersion[];
export const DEFAULT_SCHEMA_VERSION = '18.11';
```

---

## Trigger Types

```ts
export type TriggerType =
  | 'push'
  | 'tag_push'
  | 'merge_request'
  | 'branch_creation'
  | 'schedule'
  | 'web'
  | 'api'
  | 'trigger';

export type RefKind = 'branch' | 'tag';

// User-supplied input fields per trigger type
export interface TriggerInputs {
  defaultBranch: string; // always present, default "main"
  branchName?: string; // push, branch_creation, schedule, web, api, trigger
  tagName?: string; // tag_push
  refKind?: RefKind; // generic triggers (web/api/trigger) can target either a branch or a tag
  mrSourceBranch?: string; // merge_request
  mrTargetBranch?: string; // merge_request
  mrIsDraft?: boolean; // merge_request
  scheduleDescription?: string; // schedule — sets CI_PIPELINE_SCHEDULE_DESCRIPTION
}
```

---

## Custom Variables

```ts
export interface CustomVariable {
  id: string; // internal UUID, used as React key
  key: string;
  value: string;
  note?: string; // "Overrides predefined variable set by trigger context" (informational only)
}
```

---

## Validation

```ts
export interface ValidationError {
  path: string; // YAML path, e.g. "/jobs/build-job/script"
  message: string; // AJV default message
  line?: number; // line number in editor, if resolvable
}

export type ValidationResult =
  | { status: 'idle' }
  | { status: 'empty' }
  | { status: 'yaml_error'; message: string; line?: number }
  | { status: 'invalid'; errors: ValidationError[] }
  | { status: 'valid'; parsed: Record<string, unknown> }; // normalized pipeline, fed to the simulator
```

---

## Simulation

```ts
export type TriggerType = /* see above */;

// A fully resolved CI variable context (trigger + custom vars merged)
export type VariableContext = Record<string, string>;

// Result of evaluating a single job's rules/only/except
export type JobInclusionResult =
  | { included: true; when: 'on_success' | 'always' | 'manual'; warnings: string[] }
  | { included: false; reason: string };

// Resolved scripts for a job
export interface ResolvedScripts {
  beforeScript: string[];   // empty array if none
  script: string[];
  afterScript: string[];    // empty array if none
}

// A job as it appears in the simulation result
export interface SimulatedJob {
  name: string;
  stage: string;
  when: 'on_success' | 'always' | 'manual';
  scripts: ResolvedScripts;
  tags: string[];           // GitLab runner tags (job-level `tags:` array, empty if none)
  warnings: string[];       // per-job warnings (unevaluatable expr, changes:, exists:)
}

// A needs: dependency error
export interface NeedsError {
  job: string;              // the job with the needs: clause
  missingDependency: string; // the job it needs that isn't included
}

export type SimulationResult =
  | { status: 'idle' }
  | { status: 'pipeline_blocked'; matchedRule: string }   // workflow: rules: blocked
  | { status: 'complete';
      jobs: SimulatedJob[];                    // only included jobs, in execution order
      needsErrors: NeedsError[];               // all needs: violations
      includeDetected: boolean;                // true if top-level include: is present
      activeVariables: VariableContext;        // full resolved variable context
    };
```

---

## Pagination

```ts
export interface PaginationState {
  currentPage: number; // 0-indexed
  totalPages: number;
  stagesPerPage: 5;
}
```

---

## Editor

```ts
// Passed from ValidationResult to YamlEditor to trigger navigation
export interface EditorTarget {
  line: number; // 1-indexed
}
```

---

## App State (owned by App.tsx)

```ts
interface AppState {
  yaml: string;                          // persisted in sessionStorage at `gcv:yaml`
  schemaVersion: string;                 // localStorage `gcv:settings:gitlabVersion`
  defaultBranch: string;                 // localStorage `gcv:settings:defaultBranch`
  dismissedVersionWarning: string | null; // localStorage `gcv:dismissed:versionWarning`
  validationResult: ValidationResult;
  triggerType: TriggerType;
  triggerInputs: TriggerInputs;
  scopedVariables: CustomVariable[];     // localStorage `gcv:variables:scoped`
  customVariables: CustomVariable[];     // in-memory only, reset on reload
  simulationResult: SimulationResult;
  editorTarget: EditorTarget | null;     // one-shot navigation signal (cleared after applied)
  paginationPage: number;                // current page in simulation result
}
```

### Persistence keys

| Key                            | Storage          | Cleared on                      |
| ------------------------------ | ---------------- | ------------------------------- |
| `gcv:yaml`                     | `sessionStorage` | tab close                       |
| `gcv:variables:scoped`         | `localStorage`   | manual delete in panel          |
| `gcv:settings:gitlabVersion`   | `localStorage`   | manual change                   |
| `gcv:settings:defaultBranch`   | `localStorage`   | manual change                   |
| `gcv:dismissed:versionWarning` | `localStorage`   | newer version becomes available |

All other state stays in memory and resets on reload.
