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

export interface TriggerInputs {
  defaultBranch: string;
  branchName?: string;
  tagName?: string;
  refKind?: RefKind;
  mrSourceBranch?: string;
  mrTargetBranch?: string;
  mrIsDraft?: boolean;
  scheduleDescription?: string;
}

export interface CustomVariable {
  id: string;
  key: string;
  value: string;
  note?: string;
}

export interface ValidationError {
  path: string;
  message: string;
  line?: number;
}

export type ValidationResult =
  | { status: 'idle' }
  | { status: 'empty' }
  | { status: 'yaml_error'; message: string; line?: number }
  | { status: 'invalid'; errors: ValidationError[] }
  | { status: 'valid'; parsed: Record<string, unknown> };

export type VariableContext = Record<string, string>;

export type JobInclusionResult =
  | { included: true; when: 'on_success' | 'always' | 'manual'; warnings: string[] }
  | { included: false; reason: string };

export interface ResolvedScripts {
  beforeScript: string[];
  script: string[];
  afterScript: string[];
}

export interface SimulatedJob {
  name: string;
  stage: string;
  when: 'on_success' | 'always' | 'manual';
  scripts: ResolvedScripts;
  tags: string[];
  warnings: string[];
}

export interface NeedsError {
  job: string;
  missingDependency: string;
}

export type SimulationResult =
  | { status: 'idle' }
  | { status: 'pipeline_blocked'; matchedRule: string }
  | {
      status: 'complete';
      jobs: SimulatedJob[];
      needsErrors: NeedsError[];
      includeDetected: boolean;
      activeVariables: VariableContext;
    };

export interface EditorTarget {
  line: number;
}
