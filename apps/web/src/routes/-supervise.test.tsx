import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { m } from '../paraglide/messages.js';

// The page only needs the route factory; unit tests render the component itself.
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => options,
}));

const { Route } = await import('./supervise.tsx');

function renderPage() {
  const Page = (Route as unknown as { component: React.ComponentType }).component;
  render(<Page />);
}

describe('SuperviseGuide', () => {
  it('renders the headline and the lead', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(m.sup_title());
    expect(screen.getByText(m.sup_lead())).toBeInTheDocument();
  });

  it('offers the five before-you-start checkboxes, all unticked', () => {
    renderPage();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(5);
    for (const box of boxes) {
      expect(box).not.toBeChecked();
    }
  });

  it('links back to the generator', () => {
    renderPage();
    expect(screen.getByRole('link', { name: m.sup_footer_back() })).toHaveAttribute('href', '/');
  });
});
