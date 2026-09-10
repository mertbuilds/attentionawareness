import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { presets } from '../lib/profile/index.ts';
import { m } from '../paraglide/messages.js';

// The page only needs the route factory; unit tests render the component itself.
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => options,
}));

// jsdom has no object URLs, and the download path is what carries the XML out.
const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:profile');
URL.createObjectURL = createObjectURL;
URL.revokeObjectURL = vi.fn();

// The blocked apps look their artwork up on mount. Tests stay offline: Apple
// answers with nothing, so every icon falls back to an initials tile.
const fetchMock = vi.fn(
  async () => new Response(JSON.stringify({ resultCount: 0, results: [] }), { status: 200 }),
);
globalThis.fetch = fetchMock as unknown as typeof fetch;

const { Route } = await import('./index.tsx');

async function renderPage() {
  const Page = (Route as unknown as { component: React.ComponentType }).component;
  render(<Page />);
  // Flush the mount-time artwork lookup so its state update stays inside act().
  await act(async () => {});
}

const BLOCKED_APPS = presets.mert.blockedApps.length;

/** The tile that opens the floating search panel. */
function addTile(): HTMLElement {
  return screen.getByRole('button', { name: m.gen_app_search_open() });
}

async function openSearchPanel(): Promise<HTMLElement> {
  await userEvent.click(addTile());
  return screen.getByRole('dialog', { name: m.gen_app_search_open() });
}

async function downloadedXml(): Promise<string> {
  const blob = createObjectURL.mock.calls.at(-1)?.[0];
  if (blob === undefined) {
    throw new Error('Download did not create an object URL');
  }
  return blob.text();
}

describe('Generator', () => {
  beforeEach(() => {
    createObjectURL.mockClear();
    // jsdom here exposes no Storage; the guard keeps the reset honest if it does.
    globalThis.localStorage?.clear();
  });

  it('opens with the headline and the recommended apps', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(m.home_hero_line_1());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(m.home_hero_line_2());
    expect(screen.getAllByRole('button', { name: m.gen_app_remove() })).toHaveLength(BLOCKED_APPS);
  });

  it('opens the search as a floating panel focused on its input', async () => {
    await renderPage();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const panel = await openSearchPanel();

    expect(panel).toHaveAttribute('aria-modal', 'false');
    expect(within(panel).getByLabelText(m.gen_app_search_label())).toHaveFocus();
  });

  it('closes the search panel when the tile is clicked again', async () => {
    await renderPage();

    await openSearchPanel();
    await userEvent.click(addTile());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(m.gen_app_search_label())).not.toBeInTheDocument();
  });

  it('closes the search panel on Escape and hands focus back to the tile', async () => {
    await renderPage();
    await openSearchPanel();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(addTile()).toHaveFocus();
  });

  it('closes the search panel on a pointer outside it', async () => {
    await renderPage();
    await openSearchPanel();

    await userEvent.click(screen.getByRole('heading', { level: 1 }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('picks the storefront from the flag inside the search input', async () => {
    await renderPage();
    await openSearchPanel();
    const flag = screen.getByRole('button', { name: m.gen_storefront_label() });
    expect(flag).toHaveTextContent('🇺🇸');

    await userEvent.click(flag);
    await userEvent.click(screen.getByRole('option', { name: 'Türkiye' }));

    expect(flag).toHaveTextContent('🇹🇷');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByLabelText(m.gen_app_search_label())).toHaveFocus();
  });

  it('lists nothing while the search box is empty', async () => {
    await renderPage();
    await openSearchPanel();

    expect(screen.queryByRole('button', { name: m.gen_app_add() })).not.toBeInTheDocument();
    expect(screen.queryByText(m.gen_app_results_empty())).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: m.gen_app_search_clear() }),
    ).not.toBeInTheDocument();
  });

  it('empties the query from the clear button inside the input', async () => {
    await renderPage();
    await openSearchPanel();
    const input = screen.getByLabelText(m.gen_app_search_label());

    await userEvent.type(input, 'insta');
    expect(input).toHaveValue('insta');

    await userEvent.click(screen.getByRole('button', { name: m.gen_app_search_clear() }));

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(screen.queryByRole('button', { name: m.gen_app_add() })).not.toBeInTheDocument();
    expect(screen.queryByText(m.gen_app_results_empty())).not.toBeInTheDocument();
  });

  it('asks for a second click before removing an app', async () => {
    await renderPage();
    const [first, second] = screen.getAllByRole('button', { name: m.gen_app_remove() });
    if (first === undefined || second === undefined) {
      throw new Error('The preset should render at least two remove buttons');
    }

    await userEvent.click(first);
    expect(first).toHaveTextContent(m.gen_remove_confirm());
    expect(screen.getAllByRole('button', { name: m.gen_app_remove() })).toHaveLength(
      BLOCKED_APPS - 1,
    );

    // Arming another row stands the first one down: only one can be armed.
    await userEvent.click(second);
    expect(first).toHaveTextContent('×');
    expect(second).toHaveTextContent(m.gen_remove_confirm());

    await userEvent.click(second);
    expect(
      screen.queryByRole('button', { name: m.gen_app_remove_confirm() }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: m.gen_app_remove() })).toHaveLength(
      BLOCKED_APPS - 1,
    );
  });

  it('downloads the built profile', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const xml = await downloadedXml();
    expect(xml).toContain('com.atebits.Tweetie2');
    expect(xml).toContain('<integer>1</integer>');
    expect(xml).toContain('<key>ContentFilterUUID</key>');
  });

  it('drops the web filter payload when the filter is turned off', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText(m.gen_web_mode_off()));
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(await downloadedXml()).not.toContain('com.apple.webcontent-filter');
  });
});
