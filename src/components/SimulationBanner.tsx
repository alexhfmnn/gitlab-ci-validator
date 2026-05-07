import type { TriggerInputs, TriggerType } from '../types';
import './SimulationBanner.css';

interface Props {
  readonly triggerType: TriggerType;
  readonly inputs: TriggerInputs;
}

export function SimulationSuccessBanner({ triggerType, inputs }: Props) {
  return (
    <output className="simulation-banner success">
      <span className="banner-icon" aria-hidden>
        ✓
      </span>
      <span className="banner-body">
        <strong>Simulation completed successfully</strong>
        <span className="banner-description">
          {describe(triggerType, inputs)} <code>Rules</code>
          {', '}
          <code>only</code>
          {', '}
          <code>except</code>
          {', and '}
          <code>needs</code>
          {' job dependencies logic have been evaluated.'}
        </span>
      </span>
    </output>
  );
}

function describe(triggerType: TriggerType, inputs: TriggerInputs): string {
  const branch = inputs.branchName?.trim() || inputs.defaultBranch;
  const isDefault = branch === inputs.defaultBranch;
  const refKind = inputs.refKind ?? 'branch';
  const refLabel =
    refKind === 'tag' ? `tag ${inputs.tagName?.trim() || '(unset)'}` : `branch ${branch}`;

  switch (triggerType) {
    case 'push':
      return isDefault
        ? `Simulated a git push event for the default branch (${branch}).`
        : `Simulated a git push event for branch ${branch}.`;
    case 'tag_push':
      return `Simulated a tag push event for ${inputs.tagName?.trim() || '(unset tag)'}.`;
    case 'merge_request': {
      const src = inputs.mrSourceBranch?.trim() || '(source)';
      const tgt = inputs.mrTargetBranch?.trim() || inputs.defaultBranch;
      return `Simulated a merge request from ${src} into ${tgt}${
        inputs.mrIsDraft ? ' (draft)' : ''
      }.`;
    }
    case 'branch_creation':
      return `Simulated a branch creation event for ${branch}.`;
    case 'schedule':
      return `Simulated a scheduled pipeline on ${refLabel}.`;
    case 'web':
      return `Simulated a web-triggered (manual) pipeline on ${refLabel}.`;
    case 'api':
      return `Simulated an API-triggered pipeline on ${refLabel}.`;
    case 'trigger':
      return `Simulated a trigger-token pipeline on ${refLabel}.`;
  }
}
