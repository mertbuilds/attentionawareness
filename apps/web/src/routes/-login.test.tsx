import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { m } from '../paraglide/messages.js';

// The page uses router hooks and the auth client; unit tests render the
// component in isolation, so both modules are stubbed.
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => options,
  Link: ({ children, ...rest }: { children: React.ReactNode }) => <a {...rest}>{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock('../lib/auth.ts', () => ({
  authClient: { signIn: { email: vi.fn() } },
}));

const { Route } = await import('./login.tsx');

describe('LoginPage', () => {
  it('renders email + password inputs and a submit button', () => {
    const Page = (Route as unknown as { component: React.ComponentType }).component;
    render(<Page />);
    expect(screen.getByLabelText(m.auth_email_label())).toBeInTheDocument();
    expect(screen.getByLabelText(m.auth_password_label())).toBeInTheDocument();
    expect(screen.getByRole('button', { name: m.auth_login_submit() })).toBeInTheDocument();
  });

  it('shows localized validation errors on empty submit without calling the auth client', async () => {
    const { authClient } = await import('../lib/auth.ts');
    const Page = (Route as unknown as { component: React.ComponentType }).component;
    render(<Page />);
    fireEvent.click(screen.getByRole('button', { name: m.auth_login_submit() }));
    expect(await screen.findByText(m.error_email_invalid())).toBeInTheDocument();
    expect(screen.getByText(m.error_password_too_short())).toBeInTheDocument();
    expect(authClient.signIn.email).not.toHaveBeenCalled();
  });
});
