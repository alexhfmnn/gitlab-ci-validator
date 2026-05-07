import './VersionUpdateBanner.css';

interface Props {
  readonly selectedVersion: string;
  readonly latestVersion: string;
  readonly onDismiss: () => void;
  readonly onUpgrade: () => void;
}

export function VersionUpdateBanner({
  selectedVersion,
  latestVersion,
  onDismiss,
  onUpgrade,
}: Props) {
  return (
    <output className="version-update-banner">
      <span className="version-update-text">
        A newer GitLab schema version is available: <strong>{latestVersion}</strong> (you have{' '}
        <strong>{selectedVersion}</strong> selected).
      </span>
      <span className="version-update-actions">
        <button type="button" className="version-update-upgrade" onClick={onUpgrade}>
          Switch to {latestVersion}
        </button>
        <button
          type="button"
          className="version-update-dismiss"
          aria-label="Dismiss version update notice"
          onClick={onDismiss}
        >
          ×
        </button>
      </span>
    </output>
  );
}
