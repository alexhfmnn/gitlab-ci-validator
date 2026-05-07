import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ValidationResultView } from '../../components/ValidationResult';

describe('ValidationResultView', () => {
  it('renders nothing when status is idle', () => {
    const { container } = render(
      <ValidationResultView result={{ status: 'idle' }} onErrorClick={() => undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders empty banner', () => {
    render(<ValidationResultView result={{ status: 'empty' }} onErrorClick={() => undefined} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Please enter a/);
  });

  it('renders yaml_error banner with line jump', async () => {
    const onErrorClick = vi.fn();
    render(
      <ValidationResultView
        result={{ status: 'yaml_error', message: 'mapping bad', line: 3 }}
        onErrorClick={onErrorClick}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /line 3/ }));
    expect(onErrorClick).toHaveBeenCalledWith(3);
  });

  it('renders invalid status with clickable error rows', async () => {
    const onErrorClick = vi.fn();
    render(
      <ValidationResultView
        result={{
          status: 'invalid',
          errors: [
            { path: '/myjob/stage', message: 'stage is bad', line: 5 },
            { path: '/', message: 'pipeline-level' },
          ],
        }}
        onErrorClick={onErrorClick}
      />,
    );
    expect(screen.getByText(/stage is bad/)).toBeInTheDocument();
    expect(screen.getByText(/pipeline-level/)).toBeInTheDocument();

    const [firstButton] = screen.getAllByRole('button');
    if (!firstButton) throw new Error('expected at least one button');
    await userEvent.click(firstButton);
    expect(onErrorClick).toHaveBeenCalledWith(5);
  });

  it('renders valid status as a status banner', () => {
    render(
      <ValidationResultView
        result={{ status: 'valid', parsed: {} }}
        onErrorClick={() => undefined}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent(/Pipeline syntax is valid/);
  });

  it('disables error rows when the error has no line', () => {
    render(
      <ValidationResultView
        result={{
          status: 'invalid',
          errors: [{ path: '/', message: 'no line for me' }],
        }}
        onErrorClick={() => undefined}
      />,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('renders yaml_error without a line jump button when line is undefined', () => {
    render(
      <ValidationResultView
        result={{ status: 'yaml_error', message: 'mapping bad' }}
        onErrorClick={() => undefined}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});
