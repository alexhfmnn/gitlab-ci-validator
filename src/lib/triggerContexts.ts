import type { CustomVariable, TriggerInputs, TriggerType, VariableContext } from '../types';

const PLACEHOLDER_SHA = '0000000000000000000000000000000000000000';
const PLACEHOLDER_SHORT_SHA = '00000000';

export function slugify(ref: string): string {
  let result = '';
  let prevDash = false;
  const lower = ref.toLowerCase();
  for (const ch of lower) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) {
      result += ch;
      prevDash = false;
    } else if (!prevDash) {
      result += '-';
      prevDash = true;
    }
  }
  // Trim leading/trailing dashes, then truncate, then trim trailing again.
  let start = 0;
  while (start < result.length && result[start] === '-') start++;
  let end = result.length;
  while (end > start && result[end - 1] === '-') end--;
  let trimmed = result.slice(start, end).slice(0, 63);
  while (trimmed.endsWith('-')) trimmed = trimmed.slice(0, -1);
  return trimmed;
}

export function buildVariableContext(
  triggerType: TriggerType,
  inputs: TriggerInputs,
  customVariables: CustomVariable[],
  scopedVariables: CustomVariable[] = [],
): VariableContext {
  const predefined = predefinedVariables(triggerType, inputs);
  const merged: VariableContext = { ...predefined };

  // Increasing precedence: scoped (group/repo) → custom (run-pipeline).
  // Predefined keys are not overridden.
  for (const v of [...scopedVariables, ...customVariables]) {
    if (!v.key) continue;
    if (Object.hasOwn(predefined, v.key)) continue;
    merged[v.key] = v.value;
  }

  return merged;
}

function predefinedVariables(triggerType: TriggerType, inputs: TriggerInputs): VariableContext {
  const defaultBranch = inputs.defaultBranch || 'main';
  const branchName = inputs.branchName || defaultBranch;

  const commonShas = {
    CI_COMMIT_BEFORE_SHA: PLACEHOLDER_SHA,
    CI_COMMIT_SHA: PLACEHOLDER_SHA,
    CI_COMMIT_SHORT_SHA: PLACEHOLDER_SHORT_SHA,
  };

  switch (triggerType) {
    case 'push':
      return {
        CI_PIPELINE_SOURCE: 'push',
        CI_COMMIT_BRANCH: branchName,
        CI_COMMIT_REF_NAME: branchName,
        CI_COMMIT_REF_SLUG: slugify(branchName),
        CI_DEFAULT_BRANCH: defaultBranch,
        CI_COMMIT_REF_PROTECTED: 'false',
        ...commonShas,
      };

    case 'tag_push': {
      const tag = inputs.tagName || 'v0.0.0';
      return {
        CI_PIPELINE_SOURCE: 'push',
        CI_COMMIT_TAG: tag,
        CI_COMMIT_REF_NAME: tag,
        CI_COMMIT_REF_SLUG: slugify(tag),
        CI_DEFAULT_BRANCH: defaultBranch,
        CI_COMMIT_REF_PROTECTED: 'false',
        ...commonShas,
      };
    }

    case 'merge_request': {
      const src = inputs.mrSourceBranch || 'feature-branch';
      const tgt = inputs.mrTargetBranch || defaultBranch;
      const title = inputs.mrIsDraft ? 'Draft: simulated MR' : 'simulated MR';
      return {
        CI_PIPELINE_SOURCE: 'merge_request_event',
        CI_MERGE_REQUEST_SOURCE_BRANCH_NAME: src,
        CI_MERGE_REQUEST_TARGET_BRANCH_NAME: tgt,
        CI_MERGE_REQUEST_TITLE: title,
        CI_MERGE_REQUEST_DRAFT: inputs.mrIsDraft ? 'true' : 'false',
        CI_MERGE_REQUEST_EVENT_TYPE: 'detached',
        CI_COMMIT_REF_NAME: src,
        CI_COMMIT_REF_SLUG: slugify(src),
        CI_DEFAULT_BRANCH: defaultBranch,
        CI_COMMIT_SHA: PLACEHOLDER_SHA,
        CI_COMMIT_SHORT_SHA: PLACEHOLDER_SHORT_SHA,
      };
    }

    case 'branch_creation':
      return {
        CI_PIPELINE_SOURCE: 'push',
        CI_COMMIT_BRANCH: branchName,
        CI_COMMIT_REF_NAME: branchName,
        CI_COMMIT_REF_SLUG: slugify(branchName),
        CI_DEFAULT_BRANCH: defaultBranch,
        CI_COMMIT_REF_PROTECTED: 'false',
        CI_COMMIT_BEFORE_SHA: PLACEHOLDER_SHA,
        CI_COMMIT_SHA: PLACEHOLDER_SHA,
        CI_COMMIT_SHORT_SHA: PLACEHOLDER_SHORT_SHA,
      };

    case 'schedule': {
      const ctx: VariableContext = {
        CI_PIPELINE_SOURCE: 'schedule',
        ...refVariables(inputs, defaultBranch),
        CI_DEFAULT_BRANCH: defaultBranch,
        CI_COMMIT_REF_PROTECTED: 'false',
        ...commonShas,
      };
      if (inputs.scheduleDescription && inputs.scheduleDescription.trim() !== '') {
        ctx['CI_PIPELINE_SCHEDULE_DESCRIPTION'] = inputs.scheduleDescription;
      }
      return ctx;
    }

    case 'web':
      return {
        CI_PIPELINE_SOURCE: 'web',
        ...refVariables(inputs, defaultBranch),
        CI_DEFAULT_BRANCH: defaultBranch,
        CI_COMMIT_REF_PROTECTED: 'false',
        ...commonShas,
      };

    case 'api':
      return {
        CI_PIPELINE_SOURCE: 'api',
        ...refVariables(inputs, defaultBranch),
        CI_DEFAULT_BRANCH: defaultBranch,
        CI_COMMIT_REF_PROTECTED: 'false',
        ...commonShas,
      };

    case 'trigger':
      return {
        CI_PIPELINE_SOURCE: 'trigger',
        CI_PIPELINE_TRIGGERED: 'true',
        ...refVariables(inputs, defaultBranch),
        CI_DEFAULT_BRANCH: defaultBranch,
        CI_COMMIT_REF_PROTECTED: 'false',
        ...commonShas,
      };
  }
}

function refVariables(inputs: TriggerInputs, defaultBranch: string): VariableContext {
  if (inputs.refKind === 'tag') {
    const tag = inputs.tagName?.trim() || inputs.branchName?.trim() || '';
    return {
      CI_COMMIT_TAG: tag,
      CI_COMMIT_REF_NAME: tag,
      CI_COMMIT_REF_SLUG: slugify(tag),
    };
  }
  const branch = inputs.branchName?.trim() || defaultBranch;
  return {
    CI_COMMIT_BRANCH: branch,
    CI_COMMIT_REF_NAME: branch,
    CI_COMMIT_REF_SLUG: slugify(branch),
  };
}

export function predefinedKeys(triggerType: TriggerType, inputs: TriggerInputs): Set<string> {
  return new Set(Object.keys(predefinedVariables(triggerType, inputs)));
}
