import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ValidateButton } from '../../components/ValidateButton';

describe('ValidateButton', () => {
  it('renders idle label and is enabled', () => {
    render(<ValidateButton onValidate={() => undefined} busy={false} />);
    const btn = screen.getByRole('button', { name: 'Validate pipeline' });
    expect(btn).toBeEnabled();
  });

  it('renders busy label and is disabled when busy', () => {
    render(<ValidateButton onValidate={() => undefined} busy={true} />);
    const btn = screen.getByRole('button', { name: /Validating/i });
    expect(btn).toBeDisabled();
  });

  it('calls onValidate when clicked', async () => {
    const onValidate = vi.fn();
    render(<ValidateButton onValidate={onValidate} busy={false} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onValidate).toHaveBeenCalledTimes(1);
  });
});
