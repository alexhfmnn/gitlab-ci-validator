import type { RefKind, TriggerInputs, TriggerType } from '../types';
import './TriggerSelector.css';

interface Props {
  readonly triggerType: TriggerType;
  readonly inputs: TriggerInputs;
  readonly onTypeChange: (t: TriggerType) => void;
  readonly onInputsChange: (i: TriggerInputs) => void;
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  push: 'Push event',
  tag_push: 'Tag push',
  merge_request: 'Merge request',
  branch_creation: 'Branch creation',
  schedule: 'Scheduled pipeline',
  web: 'Manual (web)',
  api: 'API',
  trigger: 'Trigger token',
};

const TRIGGER_ORDER = [
  'push',
  'tag_push',
  'merge_request',
  'branch_creation',
  'schedule',
  'web',
  'api',
  'trigger',
] as const satisfies readonly TriggerType[];

const REF_KIND_TRIGGERS = [
  'web',
  'api',
  'trigger',
  'schedule',
] as const satisfies readonly TriggerType[];
const BRANCH_ONLY_TRIGGERS = ['push', 'branch_creation'] as const satisfies readonly TriggerType[];

const REF_KINDS = ['branch', 'tag'] as const satisfies readonly RefKind[];

function isTriggerType(value: string): value is TriggerType {
  return (TRIGGER_ORDER as readonly string[]).includes(value);
}

function isRefKind(value: string): value is RefKind {
  return (REF_KINDS as readonly string[]).includes(value);
}

export function TriggerSelector({ triggerType, inputs, onTypeChange, onInputsChange }: Props) {
  const update = (patch: Partial<TriggerInputs>) => {
    onInputsChange({ ...inputs, ...patch });
  };

  const refKind: RefKind = inputs.refKind ?? 'branch';

  return (
    <div className="trigger-bar">
      <span
        className="trigger-bar-label"
        title="The event that started the pipeline. Sets predefined CI variables accordingly."
      >
        Pipeline run source{' '}
        <span className="hint-icon" aria-hidden>
          ?
        </span>
      </span>

      <select
        className="trigger-type-select"
        aria-label="Pipeline source type"
        value={triggerType}
        onChange={(e) => {
          if (isTriggerType(e.target.value)) onTypeChange(e.target.value);
        }}
      >
        {TRIGGER_ORDER.map((t) => (
          <option key={t} value={t}>
            {TRIGGER_LABELS[t]}
          </option>
        ))}
      </select>

      {(BRANCH_ONLY_TRIGGERS as readonly TriggerType[]).includes(triggerType) && (
        <BranchPill
          value={inputs.branchName ?? ''}
          placeholder={inputs.defaultBranch}
          onChange={(v) => {
            update({ branchName: v });
          }}
        />
      )}

      {(REF_KIND_TRIGGERS as readonly TriggerType[]).includes(triggerType) && (
        <>
          <select
            className="ref-kind-select"
            aria-label="Ref kind"
            value={refKind}
            onChange={(e) => {
              if (isRefKind(e.target.value)) update({ refKind: e.target.value });
            }}
          >
            <option value="branch">branch</option>
            <option value="tag">tag</option>
          </select>
          {refKind === 'tag' ? (
            <BranchPill
              icon="tag"
              value={inputs.tagName ?? ''}
              placeholder="v1.0.0"
              onChange={(v) => {
                update({ tagName: v });
              }}
            />
          ) : (
            <BranchPill
              value={inputs.branchName ?? ''}
              placeholder={inputs.defaultBranch}
              onChange={(v) => {
                update({ branchName: v });
              }}
            />
          )}
        </>
      )}

      {triggerType === 'tag_push' && (
        <BranchPill
          icon="tag"
          value={inputs.tagName ?? ''}
          placeholder="v1.0.0"
          onChange={(v) => {
            update({ tagName: v });
          }}
        />
      )}

      {triggerType === 'merge_request' && (
        <span className="mr-fields">
          <BranchPill
            label="source"
            value={inputs.mrSourceBranch ?? ''}
            placeholder="feature"
            onChange={(v) => {
              update({ mrSourceBranch: v });
            }}
          />
          <span className="mr-arrow" aria-hidden>
            →
          </span>
          <BranchPill
            label="target"
            value={inputs.mrTargetBranch ?? ''}
            placeholder={inputs.defaultBranch}
            onChange={(v) => {
              update({ mrTargetBranch: v });
            }}
          />
          <label className="mr-draft">
            <input
              type="checkbox"
              checked={inputs.mrIsDraft ?? false}
              onChange={(e) => {
                update({ mrIsDraft: e.target.checked });
              }}
            />
            <span>Draft</span>
          </label>
        </span>
      )}

      {triggerType === 'schedule' && (
        <input
          className="schedule-desc"
          type="text"
          aria-label="Schedule description"
          value={inputs.scheduleDescription ?? ''}
          placeholder="schedule description (optional)"
          onChange={(e) => {
            update({ scheduleDescription: e.target.value });
          }}
        />
      )}
    </div>
  );
}

interface PillProps {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly placeholder?: string;
  readonly label?: string;
  readonly icon?: 'branch' | 'tag';
}

function BranchPill({ value, onChange, placeholder, label, icon = 'branch' }: PillProps) {
  return (
    <span className="branch-pill">
      <span className="pill-icon" aria-hidden>
        {icon === 'tag' ? '🏷' : '⎇'}
      </span>
      {label && <span className="pill-label">{label}:</span>}
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      />
    </span>
  );
}
