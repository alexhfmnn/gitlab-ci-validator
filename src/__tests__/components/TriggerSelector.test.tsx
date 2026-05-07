import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TriggerSelector } from '../../components/TriggerSelector';
import type { TriggerInputs, TriggerType } from '../../types';

const baseInputs: TriggerInputs = { defaultBranch: 'main', branchName: 'main' };

function renderSelector(
  overrides: {
    triggerType?: TriggerType;
    inputs?: Partial<TriggerInputs>;
  } = {},
) {
  const onTypeChange = vi.fn();
  const onInputsChange = vi.fn();
  render(
    <TriggerSelector
      triggerType={overrides.triggerType ?? 'push'}
      inputs={{ ...baseInputs, ...overrides.inputs }}
      onTypeChange={onTypeChange}
      onInputsChange={onInputsChange}
    />,
  );
  return { onTypeChange, onInputsChange };
}

describe('TriggerSelector', () => {
  it('shows the source label and the trigger select', () => {
    renderSelector();
    expect(screen.getByText(/Pipeline run source/)).toBeInTheDocument();
    expect(screen.getByLabelText('Pipeline source type')).toBeInTheDocument();
  });

  it('emits onTypeChange when a different trigger is picked', async () => {
    const { onTypeChange } = renderSelector();
    await userEvent.selectOptions(screen.getByLabelText('Pipeline source type'), 'tag_push');
    expect(onTypeChange).toHaveBeenCalledWith('tag_push');
  });

  it('renders a ref-kind select for refKind triggers', () => {
    renderSelector({ triggerType: 'web' });
    expect(screen.getByLabelText('Ref kind')).toBeInTheDocument();
  });

  it('does not render the ref-kind select for branch-only triggers', () => {
    renderSelector({ triggerType: 'push' });
    expect(screen.queryByLabelText('Ref kind')).toBeNull();
  });

  it('emits refKind change when toggled to tag', async () => {
    const { onInputsChange } = renderSelector({
      triggerType: 'web',
      inputs: { refKind: 'branch' },
    });
    await userEvent.selectOptions(screen.getByLabelText('Ref kind'), 'tag');
    const lastCall = onInputsChange.mock.calls.at(-1)?.[0] as TriggerInputs;
    expect(lastCall.refKind).toBe('tag');
  });

  it('renders MR fields when triggerType is merge_request', () => {
    renderSelector({ triggerType: 'merge_request' });
    expect(screen.getByText('source:')).toBeInTheDocument();
    expect(screen.getByText('target:')).toBeInTheDocument();
    expect(screen.getByLabelText(/Draft/)).toBeInTheDocument();
  });

  it('renders the tag pill for tag_push', () => {
    renderSelector({ triggerType: 'tag_push', inputs: { tagName: '' } });
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('emits tag input changes for tag_push', () => {
    const { onInputsChange } = renderSelector({ triggerType: 'tag_push' });
    const tagInput = screen.getAllByRole('textbox').at(-1);
    if (!tagInput) throw new Error('expected an input');
    fireEvent.change(tagInput, { target: { value: 'v9' } });
    const lastCall = onInputsChange.mock.calls.at(-1)?.[0] as TriggerInputs;
    expect(lastCall.tagName).toBe('v9');
  });

  it('emits branch changes for push trigger', () => {
    const { onInputsChange } = renderSelector({
      triggerType: 'push',
      inputs: { branchName: '' },
    });
    const input = screen.getAllByRole('textbox').at(-1);
    if (!input) throw new Error('expected an input');
    fireEvent.change(input, { target: { value: 'feat/x' } });
    const lastCall = onInputsChange.mock.calls.at(-1)?.[0] as TriggerInputs;
    expect(lastCall.branchName).toBe('feat/x');
  });

  it('renders the schedule description input and emits changes', () => {
    const { onInputsChange } = renderSelector({ triggerType: 'schedule' });
    const desc = screen.getByLabelText('Schedule description');
    fireEvent.change(desc, { target: { value: 'nightly' } });
    const lastCall = onInputsChange.mock.calls.at(-1)?.[0] as TriggerInputs;
    expect(lastCall.scheduleDescription).toBe('nightly');
  });

  it('emits MR source/target/draft changes', async () => {
    const { onInputsChange } = renderSelector({
      triggerType: 'merge_request',
      inputs: { mrSourceBranch: '', mrTargetBranch: '', mrIsDraft: false },
    });
    await userEvent.click(screen.getByLabelText(/Draft/));
    const lastCall = onInputsChange.mock.calls.at(-1)?.[0] as TriggerInputs;
    expect(lastCall.mrIsDraft).toBe(true);
  });

  it('emits MR source branch input changes', () => {
    const { onInputsChange } = renderSelector({
      triggerType: 'merge_request',
      inputs: { mrSourceBranch: '', mrTargetBranch: '', mrIsDraft: false },
    });
    const inputs = screen.getAllByRole('textbox');
    const sourceInput = inputs[0];
    if (!sourceInput) throw new Error('expected source input');
    fireEvent.change(sourceInput, { target: { value: 'feat' } });
    const lastCall = onInputsChange.mock.calls.at(-1)?.[0] as TriggerInputs;
    expect(lastCall.mrSourceBranch).toBe('feat');
  });

  it('emits MR target branch input changes', () => {
    const { onInputsChange } = renderSelector({
      triggerType: 'merge_request',
      inputs: { mrSourceBranch: '', mrTargetBranch: '', mrIsDraft: false },
    });
    const inputs = screen.getAllByRole('textbox');
    const targetInput = inputs[1];
    if (!targetInput) throw new Error('expected target input');
    fireEvent.change(targetInput, { target: { value: 'main' } });
    const lastCall = onInputsChange.mock.calls.at(-1)?.[0] as TriggerInputs;
    expect(lastCall.mrTargetBranch).toBe('main');
  });

  it('emits tag input changes for refKind=tag triggers', () => {
    const { onInputsChange } = renderSelector({
      triggerType: 'web',
      inputs: { refKind: 'tag', tagName: '' },
    });
    const tagInput = screen.getAllByRole('textbox').at(-1);
    if (!tagInput) throw new Error('expected an input');
    fireEvent.change(tagInput, { target: { value: 'v1' } });
    const lastCall = onInputsChange.mock.calls.at(-1)?.[0] as TriggerInputs;
    expect(lastCall.tagName).toBe('v1');
  });

  it('emits branch input changes for refKind=branch triggers', () => {
    const { onInputsChange } = renderSelector({
      triggerType: 'web',
      inputs: { refKind: 'branch', branchName: '' },
    });
    const input = screen.getAllByRole('textbox').at(-1);
    if (!input) throw new Error('expected an input');
    fireEvent.change(input, { target: { value: 'b' } });
    const lastCall = onInputsChange.mock.calls.at(-1)?.[0] as TriggerInputs;
    expect(lastCall.branchName).toBe('b');
  });
});
