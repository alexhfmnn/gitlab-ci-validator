import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PipelineSettings } from '../../components/PipelineSettings';

describe('PipelineSettings', () => {
  it('renders the version + default-branch selectors', () => {
    render(
      <PipelineSettings
        version="18.11"
        onVersionChange={() => undefined}
        defaultBranch="main"
        onDefaultBranchChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText(/GitLab version/)).toHaveValue('18.11');
    expect(screen.getByLabelText(/Default branch/)).toHaveValue('main');
  });

  it('emits onVersionChange when a different version is picked', async () => {
    const onVersionChange = vi.fn();
    render(
      <PipelineSettings
        version="18.11"
        onVersionChange={onVersionChange}
        defaultBranch="main"
        onDefaultBranchChange={() => undefined}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText(/GitLab version/), '18.10');
    expect(onVersionChange).toHaveBeenCalledWith('18.10');
  });

  it('falls back to "main" when stored default branch is unknown', () => {
    render(
      <PipelineSettings
        version="18.11"
        onVersionChange={() => undefined}
        defaultBranch="not-in-list"
        onDefaultBranchChange={() => undefined}
      />,
    );
    expect(screen.getByLabelText(/Default branch/)).toHaveValue('main');
  });
});
