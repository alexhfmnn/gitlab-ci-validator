import { useState } from 'react';
import type { VariableContext } from '../types';
import './ActiveVariablesPanel.css';

interface Props {
  readonly variables: VariableContext;
}

export function ActiveVariablesPanel({ variables }: Props) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(variables).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return null;

  return (
    <div className="active-variables">
      <button
        type="button"
        className="active-variables-toggle"
        onClick={() => {
          setOpen((prev) => !prev);
        }}
        aria-expanded={open}
      >
        {open ? '▼' : '▶'} Active variables ({entries.length})
      </button>
      {open && (
        <table className="active-variables-table">
          <tbody>
            {entries.map(([key, value]) => (
              <tr key={key}>
                <td className="var-key">{key}</td>
                <td className="var-value">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
