import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CICDVariablesPanel } from '../../components/CICDVariablesPanel';
import type { CustomVariable } from '../../types';

function setup(scoped: CustomVariable[] = [], custom: CustomVariable[] = []) {
  const onScopedChange = vi.fn();
  const onCustomChange = vi.fn();
  const utils = render(
    <CICDVariablesPanel
      scopedVariables={scoped}
      customVariables={custom}
      onScopedChange={onScopedChange}
      onCustomChange={onCustomChange}
    />,
  );
  return { onScopedChange, onCustomChange, ...utils };
}

describe('CICDVariablesPanel', () => {
  it('renders both sections with empty hints', () => {
    setup();
    expect(
      screen.getByRole('heading', { level: 3, name: /Group \/ Repository/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /^Custom$/ })).toBeInTheDocument();
    expect(screen.getAllByText(/No variables defined/i)).toHaveLength(2);
  });

  it('adds a row to the scoped section when "+ Add variable" is clicked', async () => {
    const { onScopedChange } = setup();
    const scopedHeading = screen.getByRole('heading', { level: 3, name: /Group \/ Repository/ });
    const scopedSection = scopedHeading.closest('section')!;
    await userEvent.click(within(scopedSection).getByRole('button', { name: /\+ Add variable/ }));
    expect(onScopedChange).toHaveBeenCalledTimes(1);
    expect(onScopedChange.mock.calls[0]?.[0]).toHaveLength(1);
  });

  it('renders scoped variables as input rows', () => {
    setup([{ id: '1', key: 'TOKEN', value: 'abc', note: 'example' }]);
    expect(screen.getByDisplayValue('TOKEN')).toBeInTheDocument();
    expect(screen.getByDisplayValue('abc')).toBeInTheDocument();
    expect(screen.getByDisplayValue('example')).toBeInTheDocument();
  });

  it('removes a scoped variable when × is clicked', async () => {
    const { onScopedChange } = setup([{ id: '1', key: 'TOKEN', value: 'abc' }]);
    await userEvent.click(screen.getByRole('button', { name: /Remove TOKEN/ }));
    expect(onScopedChange).toHaveBeenCalledWith([]);
  });

  it('updates a custom variable key on input change', async () => {
    const { onCustomChange } = setup([], [{ id: 'r1', key: 'A', value: '1' }]);
    const keyInput = screen.getByDisplayValue('A');
    await userEvent.type(keyInput, 'B');
    expect(onCustomChange).toHaveBeenCalled();
    const lastCall = onCustomChange.mock.calls.at(-1)?.[0] as CustomVariable[];
    expect(lastCall[0]?.key).toBe('AB');
  });

  it('updates a custom variable value on input change', async () => {
    const { onCustomChange } = setup([], [{ id: 'r1', key: 'A', value: '1' }]);
    const valueInput = screen.getByDisplayValue('1');
    await userEvent.type(valueInput, '2');
    const lastCall = onCustomChange.mock.calls.at(-1)?.[0] as CustomVariable[];
    expect(lastCall[0]?.value).toBe('12');
  });

  it('updates a custom variable note on input change', async () => {
    const { onCustomChange } = setup([], [{ id: 'r1', key: 'A', value: '1', note: 'n' }]);
    const noteInput = screen.getByDisplayValue('n');
    await userEvent.type(noteInput, 'x');
    const lastCall = onCustomChange.mock.calls.at(-1)?.[0] as CustomVariable[];
    expect(lastCall[0]?.note).toBe('nx');
  });

  it('adds a row to the custom section when "+ Add variable" is clicked', async () => {
    const { onCustomChange } = setup();
    const customHeading = screen.getByRole('heading', { level: 3, name: /^Custom$/ });
    const customSection = customHeading.closest('section');
    if (!customSection) throw new Error('expected custom section');
    await userEvent.click(within(customSection).getByRole('button', { name: /\+ Add variable/ }));
    expect(onCustomChange).toHaveBeenCalledTimes(1);
  });

  it('removes a custom variable when × is clicked (no key shown)', async () => {
    const { onCustomChange } = setup([], [{ id: 'r1', key: '', value: '1' }]);
    await userEvent.click(screen.getByRole('button', { name: /Remove variable/ }));
    expect(onCustomChange).toHaveBeenCalledWith([]);
  });

  it('updates only the targeted row when multiple are present', async () => {
    const { onCustomChange } = setup(
      [],
      [
        { id: 'r1', key: 'A', value: '1' },
        { id: 'r2', key: 'B', value: '2' },
      ],
    );
    await userEvent.type(screen.getByDisplayValue('B'), 'X');
    const lastCall = onCustomChange.mock.calls.at(-1)?.[0] as CustomVariable[];
    expect(lastCall[0]?.key).toBe('A');
    expect(lastCall[1]?.key).toBe('BX');
  });
});
