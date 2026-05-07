import type { ValidationResult } from '../types';
import './ValidationResult.css';

interface Props {
  readonly result: ValidationResult;
  readonly onErrorClick: (line: number) => void;
}

export function ValidationResultView({ result, onErrorClick }: Props) {
  if (result.status === 'idle') return null;

  if (result.status === 'empty') {
    return (
      <div className="validation-banner empty" role="alert">
        Please enter a .gitlab-ci.yml.
      </div>
    );
  }

  if (result.status === 'yaml_error') {
    const line = result.line;
    return (
      <div className="validation-banner error" role="alert">
        <strong>YAML parse error:</strong> {result.message}
        {line !== undefined && (
          <button
            type="button"
            className="line-jump"
            onClick={() => {
              onErrorClick(line);
            }}
          >
            (line {line})
          </button>
        )}
      </div>
    );
  }

  if (result.status === 'invalid') {
    return (
      <div className="validation-banner error" role="alert">
        <strong>Validation failed</strong>
        <ul className="error-list">
          {result.errors.map((err) => {
            const line = err.line;
            return (
              <li key={`${err.path}|${err.message}|${line ?? ''}`}>
                <button
                  type="button"
                  className="error-row"
                  onClick={
                    line === undefined
                      ? undefined
                      : () => {
                          onErrorClick(line);
                        }
                  }
                  disabled={line === undefined}
                >
                  <span className="error-path">{err.path || '/'}:</span>{' '}
                  <span className="error-message">{err.message}</span>
                  {line !== undefined && <span className="error-line"> (line {line})</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return <output className="validation-banner valid">Pipeline syntax is valid</output>;
}
