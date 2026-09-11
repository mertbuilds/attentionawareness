import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { m } from '../paraglide/messages.js';

// The page only needs the route factory; unit tests render the component itself.
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => options,
}));

const { Route } = await import('./extension.privacy.tsx');

function renderPage() {
  const Page = (Route as unknown as { component: React.ComponentType }).component;
  render(<Page />);
}

describe('ExtensionPrivacy', () => {
  it('renders the headline and the lead', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(m.ext_privacy_title());
    expect(screen.getByText(m.ext_privacy_lead())).toBeInTheDocument();
  });

  it('answers the five questions a reader has about the extension', () => {
    renderPage();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent);
    expect(headings).toEqual([
      m.ext_privacy_stores_title(),
      m.ext_privacy_sends_title(),
      m.ext_privacy_sees_title(),
      m.ext_privacy_source_title(),
      m.ext_privacy_contact_title(),
    ]);
  });

  it('links to the repository and to the issues page', () => {
    renderPage();
    expect(screen.getByRole('link', { name: m.ext_privacy_source_link() })).toHaveAttribute(
      'href',
      'https://github.com/mertbuilds/attentionawareness',
    );
    expect(screen.getByRole('link', { name: m.ext_privacy_contact_link() })).toHaveAttribute(
      'href',
      'https://github.com/mertbuilds/attentionawareness/issues',
    );
  });
});
