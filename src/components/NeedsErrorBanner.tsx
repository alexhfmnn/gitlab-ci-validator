import type { NeedsError } from '../types';
import './NeedsErrorBanner.css';

interface Props {
  readonly errors: NeedsError[];
}

export function NeedsErrorBanner({ errors }: Props) {
  if (errors.length === 0) return null;

  return (
    <div className="needs-error" role="alert">
      <strong>
        Unsatisfied <code>needs:</code>
      </strong>
      <ul>
        {errors.map((err) => (
          <li key={`${err.job}|${err.missingDependency}`}>
            <code>{err.job}</code> needs <code>{err.missingDependency}</code>, which is excluded
            from this pipeline.
          </li>
        ))}
      </ul>
    </div>
  );
}
