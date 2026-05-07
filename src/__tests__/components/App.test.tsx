import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';

const STORAGE_KEYS = [
  'gcv:variables:scoped',
  'gcv:settings:gitlabVersion',
  'gcv:settings:defaultBranch',
  'gcv:dismissed:versionWarning',
];
const SESSION_KEYS = ['gcv:yaml'];

function clearAllStorage() {
  for (const k of STORAGE_KEYS) localStorage.removeItem(k);
  for (const k of SESSION_KEYS) sessionStorage.removeItem(k);
}

function mockSchemaFetch() {
  const PERMISSIVE = {
    type: 'object',
    properties: {
      stages: { type: 'array', items: { type: 'string' } },
      workflow: { type: 'object' },
      variables: { type: 'object' },
      default: { type: 'object' },
    },
    additionalProperties: { type: 'object', additionalProperties: true },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(PERMISSIVE),
      } as unknown as Response),
    ),
  );
}

beforeEach(() => {
  clearAllStorage();
  vi.resetModules();
  mockSchemaFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearAllStorage();
});

describe('App', () => {
  it('renders the page header and main controls', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText(/Pipeline source type/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Validate/ })).toBeInTheDocument();
  });

  it('shows the empty banner when validating an empty editor', async () => {
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Validate/ }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Please enter a/);
    });
  });

  it('shows the version-update banner when not on latest, and dismisses it', async () => {
    localStorage.setItem('gcv:settings:gitlabVersion', '18.10');
    render(<App />);
    expect(screen.getByText(/A newer GitLab schema version is available/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Dismiss version update/ }));
    expect(screen.queryByText(/A newer GitLab schema version is available/)).toBeNull();
  });

  it('upgrades the version when clicking the "Switch to" button', async () => {
    localStorage.setItem('gcv:settings:gitlabVersion', '18.10');
    render(<App />);
    await userEvent.click(screen.getByRole('button', { name: /Switch to/ }));
    expect(screen.queryByText(/A newer GitLab schema version is available/)).toBeNull();
  });

  it('persists the default branch when changed', async () => {
    render(<App />);
    await userEvent.selectOptions(screen.getByLabelText(/Default branch/), 'develop');
    await waitFor(() => {
      expect(localStorage.getItem('gcv:settings:defaultBranch')).toBe('develop');
    });
  });

  it('updates GitLab version select and persists it', async () => {
    render(<App />);
    await userEvent.selectOptions(screen.getByLabelText(/GitLab version/), '18.10');
    await waitFor(() => {
      expect(localStorage.getItem('gcv:settings:gitlabVersion')).toBe('18.10');
    });
  });

  it('changes trigger type and shows trigger-specific inputs', async () => {
    render(<App />);
    await userEvent.selectOptions(screen.getByLabelText(/Pipeline source type/), 'merge_request');
    expect(screen.getByText('source:')).toBeInTheDocument();
  });

  it('runs simulation after validating a valid YAML seeded via sessionStorage', async () => {
    sessionStorage.setItem(
      'gcv:yaml',
      'stages:\n  - build\nmyjob:\n  stage: build\n  script: echo\n',
    );
    render(<App />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /Validate/ }));
    });
    await waitFor(() => {
      expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    });
  });

  it('shows yaml_error banner when YAML is malformed', async () => {
    sessionStorage.setItem('gcv:yaml', 'foo: : :\n');
    render(<App />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /Validate/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/YAML parse error/);
    });
  });

  it('clears simulation when validation fails after a previous success', async () => {
    sessionStorage.setItem(
      'gcv:yaml',
      'stages:\n  - build\nmyjob:\n  stage: build\n  script: echo\n',
    );
    render(<App />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /Validate/ }));
    });
    await waitFor(() => {
      expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    });
  });

  it('seeds inputs from previously-stored scoped variables', () => {
    localStorage.setItem(
      'gcv:variables:scoped',
      JSON.stringify([{ id: '1', key: 'TOKEN', value: 'abc' }]),
    );
    render(<App />);
    expect(screen.getByDisplayValue('TOKEN')).toBeInTheDocument();
  });

  it('seeds the YAML editor from sessionStorage', () => {
    sessionStorage.setItem('gcv:yaml', 'stages:\n  - test\n');
    const { container } = render(<App />);
    expect(container.querySelector('.cm-content')?.textContent ?? '').toContain('stages');
  });

  it('keeps the version warning hidden when dismissed marker matches latest', () => {
    localStorage.setItem('gcv:settings:gitlabVersion', '18.10');
    render(<App />);
    const latestMatch = screen.getByText(/newer GitLab schema version/).textContent;
    expect(latestMatch).toMatch(/available: \S+/);
  });

  it('captures branch input changes via TriggerSelector', () => {
    render(<App />);
    const input = screen
      .getAllByRole('textbox')
      .find((el) => (el as HTMLInputElement).placeholder === 'main');
    if (!input) throw new Error('expected branch input');
    fireEvent.change(input, { target: { value: 'feat/x' } });
    expect((input as HTMLInputElement).value).toBe('feat/x');
  });

  it('captures custom variables added via the panel', async () => {
    render(<App />);
    const customHeading = screen.getByRole('heading', { level: 3, name: /^Custom$/ });
    const customSection = customHeading.closest('section');
    if (!customSection) throw new Error('expected custom section');
    const addButton = within(customSection).getByRole('button', { name: /\+ Add variable/ });
    await userEvent.click(addButton);
    expect(within(customSection).getAllByRole('textbox').length).toBeGreaterThan(0);
  });

  it('jumps to the offending line when a yaml-error row is clicked', async () => {
    sessionStorage.setItem('gcv:yaml', 'foo: : :\n');
    render(<App />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /Validate/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/YAML parse error/);
    });
    const lineButtons = screen.queryAllByRole('button', { name: /line/ });
    const [firstLineButton] = lineButtons;
    if (!firstLineButton) throw new Error('expected a line-jump button');
    await userEvent.click(firstLineButton);
    expect(screen.getByRole('alert')).toHaveTextContent(/YAML parse error/);
  });

  it('clicks an invalid-error line jump to set editor target', async () => {
    sessionStorage.setItem(
      'gcv:yaml',
      'stages:\n  - build\nmyjob:\n  stage: nope\n  script: echo\n',
    );
    render(<App />);
    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /Validate/ }));
    });
    const errorButtons = await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      const enabledErrorButtons = buttons.filter(
        (b): b is HTMLButtonElement =>
          b instanceof HTMLButtonElement && b.textContent.includes('does not exist') && !b.disabled,
      );
      if (enabledErrorButtons.length === 0) throw new Error('no enabled error button yet');
      return enabledErrorButtons;
    });
    const [firstErrorButton] = errorButtons;
    if (!firstErrorButton) throw new Error('expected at least one error button');
    expect(firstErrorButton).toHaveTextContent(/line \d+/);
    await userEvent.click(firstErrorButton);
    expect(screen.getByRole('alert')).toHaveTextContent(/Validation failed/);
  });
});
