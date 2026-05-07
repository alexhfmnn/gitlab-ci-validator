import type {
  CustomVariable,
  NeedsError,
  SimulatedJob,
  SimulationResult,
  TriggerInputs,
  TriggerType,
} from '../types';
import { buildVariableContext } from './triggerContexts';
import { evaluateJobInclusion, evaluateWorkflowRules } from './rulesEvaluator';
import { resolveScripts } from './scriptResolver';
import { isPlainObject } from './typeGuards';

const RESERVED_TOP_LEVEL_KEYS = new Set([
  'stages',
  'variables',
  'default',
  'workflow',
  'include',
  'image',
  'services',
  'before_script',
  'after_script',
  'cache',
]);

const DEFAULT_STAGES = ['build', 'test', 'deploy'];

interface RawJob {
  name: string;
  def: Record<string, unknown>;
}

export function simulate(
  parsedYaml: Record<string, unknown>,
  triggerType: TriggerType,
  triggerInputs: TriggerInputs,
  customVariables: CustomVariable[],
  scopedVariables: CustomVariable[] = [],
): SimulationResult {
  const variables = buildVariableContext(
    triggerType,
    triggerInputs,
    customVariables,
    scopedVariables,
  );

  const workflow = isPlainObject(parsedYaml['workflow']) ? parsedYaml['workflow'] : undefined;
  const wfResult = evaluateWorkflowRules(workflow, variables);
  if (wfResult.blocked) {
    return { status: 'pipeline_blocked', matchedRule: wfResult.matchedRule };
  }

  const stages = collectStages(parsedYaml);
  const fallbackStage = stages.includes('test') ? 'test' : (stages[0] ?? 'test');
  const stageOrder = new Map(stages.map((s, i) => [s, i] as const));

  const jobs = collectJobs(parsedYaml);
  const globalDefault = isPlainObject(parsedYaml['default']) ? parsedYaml['default'] : undefined;

  const included = buildIncludedJobs(jobs, variables, globalDefault, fallbackStage);
  sortIncludedJobs(included, jobs, stageOrder);

  return {
    status: 'complete',
    jobs: included,
    needsErrors: collectNeedsErrors(included, jobs),
    includeDetected: parsedYaml['include'] !== undefined,
    activeVariables: variables,
  };
}

function collectStages(parsedYaml: Record<string, unknown>): string[] {
  const raw = parsedYaml['stages'];
  if (!Array.isArray(raw)) return DEFAULT_STAGES;
  return raw.filter((s): s is string => typeof s === 'string');
}

function collectJobs(parsedYaml: Record<string, unknown>): RawJob[] {
  const jobs: RawJob[] = [];
  for (const [key, value] of Object.entries(parsedYaml)) {
    if (RESERVED_TOP_LEVEL_KEYS.has(key)) continue;
    if (key.startsWith('.')) continue;
    if (!isPlainObject(value)) continue;
    jobs.push({ name: key, def: value });
  }
  return jobs;
}

function buildIncludedJobs(
  jobs: RawJob[],
  variables: ReturnType<typeof buildVariableContext>,
  globalDefault: Record<string, unknown> | undefined,
  fallbackStage: string,
): SimulatedJob[] {
  const included: SimulatedJob[] = [];
  for (const { name, def } of jobs) {
    const incl = evaluateJobInclusion(def, variables);
    if (!incl.included) continue;
    const declaredStage = def['stage'];
    included.push({
      name,
      stage: typeof declaredStage === 'string' ? declaredStage : fallbackStage,
      when: incl.when,
      scripts: resolveScripts(def, globalDefault),
      tags: resolveTags(def, globalDefault),
      warnings: incl.warnings,
    });
  }
  return included;
}

function sortIncludedJobs(
  included: SimulatedJob[],
  jobs: RawJob[],
  stageOrder: Map<string, number>,
): void {
  included.sort((a, b) => {
    const ai = stageOrder.get(a.stage) ?? Number.MAX_SAFE_INTEGER;
    const bi = stageOrder.get(b.stage) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    const aOrder = jobs.findIndex((j) => j.name === a.name);
    const bOrder = jobs.findIndex((j) => j.name === b.name);
    return aOrder - bOrder;
  });
}

function collectNeedsErrors(included: SimulatedJob[], jobs: RawJob[]): NeedsError[] {
  const includedNames = new Set(included.map((j) => j.name));
  const errors: NeedsError[] = [];
  for (const job of included) {
    const def = jobs.find((j) => j.name === job.name)?.def;
    const needs = def?.['needs'];
    if (!Array.isArray(needs)) continue;
    for (const need of needs) {
      const dep = parseNeed(need);
      if (!dep) continue;
      if (includedNames.has(dep.name)) continue;
      if (dep.optional) continue;
      errors.push({ job: job.name, missingDependency: dep.name });
    }
  }
  return errors;
}

function parseNeed(need: unknown): { name: string; optional: boolean } | null {
  if (typeof need === 'string') return { name: need, optional: false };
  if (!isPlainObject(need)) return null;
  if (typeof need['job'] !== 'string') return null;
  return { name: need['job'], optional: need['optional'] === true };
}

function resolveTags(
  def: Record<string, unknown>,
  globalDefault: Record<string, unknown> | undefined,
): string[] {
  const raw = def['tags'] ?? globalDefault?.['tags'];
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === 'string');
}
