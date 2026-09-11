import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { m } from '../paraglide/messages.js';

// The page only needs the route factory; unit tests render the component itself.
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => options,
}));

const { Route } = await import('./supervise.tsx');
/**
 * StyleX classes are atomic and derived from the declaration itself, so the
 * same declaration compiles to the same classes here as on the page. jsdom
 * loads no stylesheet, so this is what a computed style would have said.
 */
const struck = create({ text: { color: colors.muted, textDecorationLine: 'line-through' } });

const STRUCK_CLASSES = String(props(struck.text).className).split(' ');

function expectStruckThrough(element: HTMLElement, yes = true): void {
  for (const name of STRUCK_CLASSES) {
    if (yes) {
      expect(element).toHaveClass(name);
    } else {
      expect(element).not.toHaveClass(name);
    }
  }
}

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

  it('strikes a prerequisite out once it is ticked', async () => {
    renderPage();
    const box = screen.getByRole('checkbox', { name: m.sup_checklist_passcode() });
    const line = screen.getByText(m.sup_checklist_passcode());

    expectStruckThrough(line, false);

    await userEvent.click(box);

    expectStruckThrough(line);
  });

  it('links back to the generator', () => {
    renderPage();
    expect(screen.getByRole('link', { name: m.sup_footer_back() })).toHaveAttribute('href', '/');
  });
});
