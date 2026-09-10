import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect(screen.getAllByRole('button', { name: m.gen_app_remove() })).toHaveLength(11);
  });

  it('reveals the search panel only when asked for it', async () => {
    await renderPage();
    expect(screen.queryByLabelText(m.gen_app_search_label())).not.toBeInTheDocument();
    expect(screen.queryByLabelText(m.gen_storefront_label())).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: m.gen_app_search_open() }));

    expect(screen.getByLabelText(m.gen_app_search_label())).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('closes the search panel when the tile is clicked again', async () => {
    await renderPage();
    const trigger = screen.getByRole('button', { name: m.gen_app_search_open() });

    await userEvent.click(trigger);
    expect(screen.getByLabelText(m.gen_app_search_label())).toBeInTheDocument();

    await userEvent.click(trigger);
    expect(screen.queryByLabelText(m.gen_app_search_label())).not.toBeInTheDocument();
    expect(screen.queryByLabelText(m.gen_storefront_label())).not.toBeInTheDocument();
  });

  it('lists nothing while the search box is empty', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: m.gen_app_search_open() }));

    expect(screen.queryByRole('button', { name: m.gen_app_add() })).not.toBeInTheDocument();
    expect(screen.queryByText(m.gen_app_results_empty())).not.toBeInTheDocument();
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

  it('shows the picked storefront in the trigger', async () => {
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: m.gen_app_search_open() }));
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('United States');

    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole('option', { name: 'Türkiye' }));

    await waitFor(() => {
      expect(trigger).toHaveTextContent('Türkiye');
    });
  });
});
