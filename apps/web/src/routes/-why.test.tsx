import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { m } from '../paraglide/messages.js';

// The page only needs the route factory; unit tests render the component itself.
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => options,
}));

const { Route } = await import('./why.tsx');

function renderPage() {
  const Page = (Route as unknown as { component: React.ComponentType }).component;
  render(<Page />);
}

describe('WhyPage', () => {
  it('renders the headline and the placeholder', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(m.why_title());
    expect(screen.getByText(m.why_body())).toBeInTheDocument();
  });

  it('links back to the generator', () => {
    renderPage();
    expect(screen.getByRole('link', { name: m.why_back() })).toHaveAttribute('href', '/');
  });
});
