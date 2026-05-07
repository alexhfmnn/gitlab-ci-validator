import { SCHEMA_VERSIONS } from '../schemas.config';
import './PipelineSettings.css';

interface Props {
  readonly version: string;
  readonly onVersionChange: (label: string) => void;
  readonly defaultBranch: string;
  readonly onDefaultBranchChange: (value: string) => void;
}

const DEFAULT_BRANCH_OPTIONS = [
  'main',
  'master',
  'develop',
  'development',
  'trunk',
  'production',
  'release',
] as const satisfies readonly string[];

export function PipelineSettings({
  version,
  onVersionChange,
  defaultBranch,
  onDefaultBranchChange,
}: Props) {
  return (
    <div className="pipeline-settings">
      <div className="setting-row">
        <label htmlFor="schema-version">GitLab version</label>
        <select
          id="schema-version"
          value={version}
          onChange={(e) => {
            onVersionChange(e.target.value);
          }}
        >
          {SCHEMA_VERSIONS.map((v) => (
            <option key={v.label} value={v.label}>
              {v.label}
            </option>
          ))}
        </select>
      </div>
      <div className="setting-row">
        <label htmlFor="default-branch">Default branch</label>
        <select
          id="default-branch"
          value={
            (DEFAULT_BRANCH_OPTIONS as readonly string[]).includes(defaultBranch)
              ? defaultBranch
              : 'main'
          }
          onChange={(e) => {
            onDefaultBranchChange(e.target.value);
          }}
        >
          {DEFAULT_BRANCH_OPTIONS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
