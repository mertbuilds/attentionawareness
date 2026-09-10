import { fireEvent, render, screen } from '@testing-library/react';
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

const { Route } = await import('./index.tsx');

function renderPage() {
  const Page = (Route as unknown as { component: React.ComponentType }).component;
  render(<Page />);
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

  it('renders the default preset with its blocked apps', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: m.app_name() })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: m.gen_app_remove() })).toHaveLength(11);
  });

  it('downloads the built profile', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const xml = await downloadedXml();
    expect(xml).toContain('com.atebits.Tweetie2');
    expect(xml).toContain('<integer>1</integer>');
    expect(xml).toContain('<key>ContentFilterUUID</key>');
  });

  it('drops the web filter payload when the filter is turned off', async () => {
    renderPage();
    fireEvent.click(screen.getByLabelText(m.gen_web_mode_off()));
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(await downloadedXml()).not.toContain('com.apple.webcontent-filter');
  });
});
