export interface SchemaVersion {
  label: string;
  filename: string;
  ref: string;
}

export const SCHEMA_VERSIONS = [
  { label: '18.11', filename: 'gitlab-ci-18.11.json', ref: 'v18.11.0-ee' },
  { label: '18.10', filename: 'gitlab-ci-18.10.json', ref: 'v18.10.0-ee' },
  { label: '18.9', filename: 'gitlab-ci-18.9.json', ref: 'v18.9.0-ee' },
  { label: '18.8', filename: 'gitlab-ci-18.8.json', ref: 'v18.8.0-ee' },
  { label: '18.7', filename: 'gitlab-ci-18.7.json', ref: 'v18.7.0-ee' },
  { label: '18.6', filename: 'gitlab-ci-18.6.json', ref: 'v18.6.0-ee' },
  { label: '18.5', filename: 'gitlab-ci-18.5.json', ref: 'v18.5.0-ee' },
  { label: '18.4', filename: 'gitlab-ci-18.4.json', ref: 'v18.4.0-ee' },
  { label: '18.3', filename: 'gitlab-ci-18.3.json', ref: 'v18.3.0-ee' },
  { label: '18.2', filename: 'gitlab-ci-18.2.json', ref: 'v18.2.0-ee' },
  { label: '18.1', filename: 'gitlab-ci-18.1.json', ref: 'v18.1.0-ee' },
  { label: '18.0', filename: 'gitlab-ci-18.0.json', ref: 'v18.0.0-ee' },
  { label: '17.11', filename: 'gitlab-ci-17.11.json', ref: 'v17.11.0-ee' },
] as const satisfies readonly SchemaVersion[];

export const DEFAULT_SCHEMA_VERSION = '18.11';
