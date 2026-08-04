// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button, Checkbox, TextField } from './web';

describe('Button', () => {
  it('exposes pending state accessibly', () => {
    render(<Button pending>Save</Button>);
    const button = screen.getByRole('button', { name: 'Please wait…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});

describe('form primitives', () => {
  it('connects field help and errors to the input', () => {
    render(
      <TextField error="Required" hint="Shown to your partner only if shared." label="Name" />,
    );
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input).toHaveAccessibleDescription('Shown to your partner only if shared. Required');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('gives checkbox help an accessible relationship', () => {
    render(<Checkbox hint="Off by default." label="Share analytics" />);
    expect(screen.getByRole('checkbox', { name: 'Share analytics' })).toHaveAccessibleDescription(
      'Off by default.',
    );
  });
});
