import type { CustomVariable } from '../types';
import './CICDVariablesPanel.css';

interface Props {
  readonly scopedVariables: CustomVariable[];
  readonly customVariables: CustomVariable[];
  readonly onScopedChange: (vars: CustomVariable[]) => void;
  readonly onCustomChange: (vars: CustomVariable[]) => void;
}

let nextId = 0;
function makeId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${Date.now()}-${nextId}`;
}

export function CICDVariablesPanel({
  scopedVariables,
  customVariables,
  onScopedChange,
  onCustomChange,
}: Props) {
  return (
    <div className="cicd-variables">
      <h2 className="cicd-variables-title">CI/CD Variables</h2>

      <Section
        heading="Group / Repository"
        description="Configured at the group or project level in GitLab. Persisted in this browser across reloads."
        idPrefix="scoped"
        variables={scopedVariables}
        onChange={onScopedChange}
      />

      <Section
        heading="Custom"
        description="Per-run variables, like the ones you can pass when manually running a pipeline. Cleared on reload."
        idPrefix="run"
        variables={customVariables}
        onChange={onCustomChange}
      />
    </div>
  );
}

interface SectionProps {
  readonly heading: string;
  readonly description: string;
  readonly idPrefix: string;
  readonly variables: CustomVariable[];
  readonly onChange: (vars: CustomVariable[]) => void;
}

function Section({ heading, description, idPrefix, variables, onChange }: SectionProps) {
  const update = (id: string, patch: Partial<CustomVariable>) => {
    onChange(variables.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };

  const remove = (id: string) => {
    onChange(variables.filter((v) => v.id !== id));
  };

  const add = () => {
    onChange([...variables, { id: makeId(idPrefix), key: '', value: '', note: '' }]);
  };

  return (
    <section className="cicd-variables-section">
      <div className="section-header">
        <div className="section-title">
          <h3>{heading}</h3>
          <p className="section-subtitle">{description}</p>
        </div>
        <button type="button" className="add-variable" onClick={add}>
          + Add variable
        </button>
      </div>

      {variables.length === 0 ? (
        <p className="empty-hint">No variables defined.</p>
      ) : (
        <table className="variables-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th>Note</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {variables.map((v) => (
              <tr key={v.id}>
                <td>
                  <input
                    type="text"
                    value={v.key}
                    placeholder="MY_VAR"
                    onChange={(e) => {
                      update(v.id, { key: e.target.value });
                    }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={v.value}
                    placeholder="value"
                    onChange={(e) => {
                      update(v.id, { value: e.target.value });
                    }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={v.note ?? ''}
                    placeholder="optional"
                    onChange={(e) => {
                      update(v.id, { note: e.target.value });
                    }}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="remove-variable"
                    aria-label={`Remove ${v.key || 'variable'}`}
                    onClick={() => {
                      remove(v.id);
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
