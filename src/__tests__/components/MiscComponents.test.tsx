import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { ActiveVariablesPanel } from '../../components/ActiveVariablesPanel';
import { NeedsErrorBanner } from '../../components/NeedsErrorBanner';
import { SimulationSuccessBanner } from '../../components/SimulationBanner';
import { SimulationResultView } from '../../components/SimulationResult';
import type { SimulatedJob, TriggerInputs } from '../../types';

describe('Header', () => {
  it('renders the app title', () => {
    render(<Header />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/GitLab CI Validator/);
  });
});

describe('Footer', () => {
  it('renders a GitHub repository link or label', () => {
    render(<Footer />);
    expect(screen.getByText(/GitHub repository/)).toBeInTheDocument();
  });

  it('renders a real link when VITE_GITHUB_USERNAME is set', async () => {
    vi.stubEnv('VITE_GITHUB_USERNAME', 'octo');
    try {
      vi.resetModules();
      const { Footer: F } = await import('../../components/Footer');
      const { container } = render(<F />);
      const link = container.querySelector('a');
      expect(link?.getAttribute('href')).toBe('https://github.com/octo/gitlab-ci-validator');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('ActiveVariablesPanel', () => {
  it('renders nothing when there are no variables', () => {
    const { container } = render(<ActiveVariablesPanel variables={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('expands to show entries when toggled', async () => {
    render(<ActiveVariablesPanel variables={{ A: '1', B: '2' }} />);
    const toggle = screen.getByRole('button', { name: /Active variables \(2\)/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });
});

describe('NeedsErrorBanner', () => {
  it('renders nothing when there are no errors', () => {
    const { container } = render(<NeedsErrorBanner errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each missing dependency', () => {
    render(
      <NeedsErrorBanner
        errors={[
          { job: 'b', missingDependency: 'a' },
          { job: 'c', missingDependency: 'd' },
        ]}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();
    expect(screen.getByText('d')).toBeInTheDocument();
  });
});

describe('SimulationSuccessBanner', () => {
  const inputs: TriggerInputs = { defaultBranch: 'main', branchName: 'feature/x' };

  it('describes a push event for a non-default branch', () => {
    render(<SimulationSuccessBanner triggerType="push" inputs={inputs} />);
    expect(screen.getByRole('status')).toHaveTextContent(/git push event for branch feature\/x/);
  });

  it('describes a push event for the default branch', () => {
    render(
      <SimulationSuccessBanner
        triggerType="push"
        inputs={{ defaultBranch: 'main', branchName: 'main' }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/default branch \(main\)/);
  });

  it('describes a draft merge request', () => {
    render(
      <SimulationSuccessBanner
        triggerType="merge_request"
        inputs={{
          defaultBranch: 'main',
          mrSourceBranch: 'feat',
          mrTargetBranch: 'main',
          mrIsDraft: true,
        }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      /merge request from feat into main \(draft\)/,
    );
  });

  it('describes a tag-kind web pipeline', () => {
    render(
      <SimulationSuccessBanner
        triggerType="web"
        inputs={{ defaultBranch: 'main', refKind: 'tag', tagName: 'v1.0.0' }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/web-triggered.*tag v1\.0\.0/);
  });

  it('describes a tag push event', () => {
    render(
      <SimulationSuccessBanner
        triggerType="tag_push"
        inputs={{ defaultBranch: 'main', tagName: 'v2.0' }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/tag push event for v2\.0/);
  });

  it('describes a tag push with empty tag', () => {
    render(
      <SimulationSuccessBanner
        triggerType="tag_push"
        inputs={{ defaultBranch: 'main', tagName: '' }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/unset tag/);
  });

  it('describes a branch creation event', () => {
    render(
      <SimulationSuccessBanner
        triggerType="branch_creation"
        inputs={{ defaultBranch: 'main', branchName: 'feat/new' }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/branch creation event for feat\/new/);
  });

  it('describes a scheduled pipeline on branch', () => {
    render(
      <SimulationSuccessBanner
        triggerType="schedule"
        inputs={{ defaultBranch: 'main', branchName: 'main' }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/scheduled pipeline on branch main/);
  });

  it('describes an api pipeline', () => {
    render(<SimulationSuccessBanner triggerType="api" inputs={{ defaultBranch: 'main' }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/API-triggered pipeline/);
  });

  it('describes a trigger-token pipeline', () => {
    render(<SimulationSuccessBanner triggerType="trigger" inputs={{ defaultBranch: 'main' }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/trigger-token pipeline/);
  });

  it('describes a tag-kind web pipeline with empty tag using "(unset)"', () => {
    render(
      <SimulationSuccessBanner
        triggerType="web"
        inputs={{ defaultBranch: 'main', refKind: 'tag', tagName: '' }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/tag \(unset\)/);
  });

  it('describes an MR with empty source branch as "(source)" placeholder', () => {
    render(
      <SimulationSuccessBanner
        triggerType="merge_request"
        inputs={{ defaultBranch: 'main', mrSourceBranch: '', mrTargetBranch: '', mrIsDraft: false }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/from \(source\) into main/);
  });
});

describe('SimulationResultView', () => {
  const job: SimulatedJob = {
    name: 'build_app',
    stage: 'build',
    when: 'on_success',
    scripts: { beforeScript: ['echo before'], script: ['echo run'], afterScript: [] },
    tags: ['shared'],
    warnings: [],
  };

  it('renders nothing for idle status', () => {
    const { container } = render(<SimulationResultView result={{ status: 'idle' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders pipeline_blocked status with the matched rule', () => {
    render(<SimulationResultView result={{ status: 'pipeline_blocked', matchedRule: 'if: $X' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Pipeline blocked/);
    expect(screen.getByText(/if: \$X/)).toBeInTheDocument();
  });

  it('renders empty-jobs message when no jobs would run', () => {
    render(
      <SimulationResultView
        result={{
          status: 'complete',
          jobs: [],
          needsErrors: [],
          includeDetected: false,
          activeVariables: {},
        }}
      />,
    );
    expect(screen.getByText(/No jobs would run/)).toBeInTheDocument();
  });

  it('renders the jobs table with formatted parameter and tag list', () => {
    render(
      <SimulationResultView
        result={{
          status: 'complete',
          jobs: [job],
          needsErrors: [],
          includeDetected: true,
          activeVariables: {},
        }}
      />,
    );
    expect(screen.getByText(/Build Job - build_app/)).toBeInTheDocument();
    expect(screen.getByText('shared')).toBeInTheDocument();
    expect(screen.getByText(/directives are detected/i)).toBeInTheDocument();
  });

  it('renders the "no scripts" placeholder when a job has empty scripts', () => {
    const empty: SimulatedJob = {
      name: 'noop',
      stage: 'test',
      when: 'on_success',
      scripts: { beforeScript: [], script: [], afterScript: [] },
      tags: [],
      warnings: ['some warning'],
    };
    render(
      <SimulationResultView
        result={{
          status: 'complete',
          jobs: [empty],
          needsErrors: [],
          includeDetected: false,
          activeVariables: {},
        }}
      />,
    );
    expect(screen.getByText(/no scripts/)).toBeInTheDocument();
    expect(screen.getByText(/some warning/)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders pipeline_blocked without a matched rule', () => {
    render(<SimulationResultView result={{ status: 'pipeline_blocked', matchedRule: '' }} />);
    expect(screen.getByText(/Pipeline blocked/)).toBeInTheDocument();
    expect(screen.queryByText(/Matched rule:/)).toBeNull();
  });
});
