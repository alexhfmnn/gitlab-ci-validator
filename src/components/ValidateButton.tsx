import './ValidateButton.css';

interface Props {
  readonly onValidate: () => void | Promise<void>;
  readonly busy: boolean;
}

export function ValidateButton({ onValidate, busy }: Props) {
  return (
    <button
      type="button"
      className="validate-button"
      onClick={() => {
        void onValidate();
      }}
      disabled={busy}
    >
      {busy ? 'Validating…' : 'Validate pipeline'}
    </button>
  );
}
