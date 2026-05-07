import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VersionUpdateBanner } from '../../components/VersionUpdateBanner';

describe('VersionUpdateBanner', () => {
  function setup(overrides: Partial<Parameters<typeof VersionUpdateBanner>[0]> = {}) {
    const onDismiss = vi.fn();
    const onUpgrade = vi.fn();
    render(
      <VersionUpdateBanner
        selectedVersion="18.8"
        latestVersion="18.11"
        onDismiss={onDismiss}
        onUpgrade={onUpgrade}
        {...overrides}
      />,
    );
    return { onDismiss, onUpgrade };
  }

  it('renders selected and latest versions', () => {
    setup();
    expect(screen.getAllByText('18.11').length).toBeGreaterThan(0);
    expect(screen.getByText('18.8')).toBeInTheDocument();
  });

  it('calls onUpgrade when the switch button is clicked', async () => {
    const { onUpgrade } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Switch to 18\.11/ }));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when the × button is clicked', async () => {
    const { onDismiss } = setup();
    await userEvent.click(screen.getByRole('button', { name: /Dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
