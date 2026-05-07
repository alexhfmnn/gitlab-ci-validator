import type { SimulationResult, SimulatedJob } from '../types';
import './SimulationResult.css';

interface Props {
  readonly result: SimulationResult;
}

export function SimulationResultView({ result }: Props) {
  if (result.status === 'idle') return null;

  if (result.status === 'pipeline_blocked') {
    return (
      <div className="simulation-blocked" role="alert">
        <strong>Pipeline blocked by workflow rules</strong>
        {result.matchedRule && (
          <div className="matched-rule">
            Matched rule: <code>{result.matchedRule}</code>
          </div>
        )}
      </div>
    );
  }

  if (result.jobs.length === 0) {
    return (
      <div className="simulation-empty">
        <strong>No jobs would run</strong>
        <p>All jobs were excluded by their rules.</p>
        {result.includeDetected && <IncludeNotice />}
      </div>
    );
  }

  return (
    <div className="simulation-result">
      {result.includeDetected && <IncludeNotice />}
      <table className="jobs-table">
        <thead>
          <tr>
            <th className="col-parameter">Parameter</th>
            <th className="col-value">Value</th>
          </tr>
        </thead>
        <tbody>
          {result.jobs.map((job) => (
            <tr key={job.name}>
              <td className="col-parameter">{formatParameter(job)}</td>
              <td className="col-value">
                <JobValue job={job} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JobValue({ job }: { readonly job: SimulatedJob }) {
  const blockEntries = [
    { kind: 'before', lines: job.scripts.beforeScript },
    { kind: 'main', lines: job.scripts.script },
    { kind: 'after', lines: job.scripts.afterScript },
  ].filter((b) => b.lines.length > 0);

  return (
    <div className="job-value">
      {blockEntries.length === 0 ? (
        <div className="no-scripts">no scripts</div>
      ) : (
        blockEntries.map((block) => (
          <pre key={block.kind} className="script-block">
            {block.lines.join('\n')}
          </pre>
        ))
      )}
      <div className="job-meta">
        <div>
          <strong>Tag list:</strong>{' '}
          {job.tags.length > 0 ? (
            <span className="tag-list">{job.tags.join(', ')}</span>
          ) : (
            <span className="muted">—</span>
          )}
        </div>
        <div>
          <strong>When:</strong> <span className={`when-${job.when}`}>{job.when}</span>
        </div>
        {job.warnings.length > 0 && (
          <ul className="job-warnings">
            {job.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatParameter(job: SimulatedJob): string {
  return `${formatStage(job.stage)} Job - ${job.name}`;
}

function formatStage(stage: string): string {
  return stage
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function IncludeNotice() {
  return (
    <div className="include-notice">
      Note: <code>include:</code> directives are detected but not resolved. Included jobs are
      ignored in this simulation.
    </div>
  );
}
