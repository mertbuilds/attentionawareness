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

// This jsdom exposes no Storage either, and the saved config is read from one.
const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    clear: () => storage.clear(),
    getItem: (key: string) => storage.get(key) ?? null,
    removeItem: (key: string) => storage.delete(key),
    setItem: (key: string, value: string) => storage.set(key, value),
  },
});

/**
 * The one app the stubbed App Store answers a search with. No curated entry
 * carries its bundle id, so its site is the one behind the seller url.
 */
const SEARCH_RESULT = {
  artistName: 'Example, Inc.',
  artworkUrl100: 'https://example.test/example.png',
  bundleId: 'com.example.chat',
  sellerUrl: 'https://www.example.com/mobile',
  trackId: 447_188_370,
  trackName: 'Example - Video & Photo Chat',
};

/** The same app as the UI names it: the title without its tagline. */
const SEARCH_RESULT_NAME = 'Example';

// Tests stay offline. The mount-time lookup answers with nothing, so every
// blocked icon falls back to an initials tile; a search answers with one app.
const fetchMock = vi.fn(async (input: string) => {
  const results = input.includes('/search') ? [SEARCH_RESULT] : [];
  return new Response(JSON.stringify({ resultCount: results.length, results }), { status: 200 });
});
globalThis.fetch = fetchMock as unknown as typeof fetch;

const { Route } = await import('./index.tsx');

async function renderPage() {
  const Page = (Route as unknown as { component: React.ComponentType }).component;
  const view = render(<Page />);
  // Flush the mount-time artwork lookup so its state update stays inside act().
  await act(async () => {});
  return view;
}

const BLOCKED_APPS = presets.mert.blockedApps.length;

/** The always-visible search field at the top of the recommended apps. */
function searchInput(): HTMLElement {
  return screen.getByLabelText(m.gen_app_search_label());
}

/** The country control inside the search bar. */
function countryButton(): HTMLElement {
  return screen.getByRole('button', { name: m.gen_storefront_label() });
}

/** The remove button of one blocked app, found through its bundle id. */
function removeButtonFor(bundleId: string): HTMLElement {
  const row = screen.getByText(bundleId).closest('li');
  if (row === null) {
    throw new Error(`No blocked row for ${bundleId}`);
  }
  return within(row as HTMLElement).getByRole('button', { name: m.gen_app_remove() });
}

/** The textarea holding the sites the user added by hand. */
function customSites(): HTMLTextAreaElement {
  return screen.getByLabelText(m.gen_web_custom_label()) as HTMLTextAreaElement;
}

/** One of the four anchored answers, found by the hours it stands for. */
function pick(label: RegExp): HTMLElement {
  return screen.getByRole('radio', { name: label });
}

/** The lines of the ledger under the bar. */
function ledgerLines(): NodeListOf<HTMLLIElement> {
  const list = screen.getByRole('heading', { name: m.home_ledger_title() }).nextElementSibling;
  if (list === null) {
    throw new Error('The ledger heading should be followed by its list');
  }
  return list.querySelectorAll('li');
}

/** The burned part of the bar: the element the years label sits in. */
function burnedRegion(years: string): HTMLElement {
  const label = screen.getByText(m.home_math_bar_years({ years }));
  const region = label.parentElement;
  if (region === null) {
    throw new Error('The years label should sit inside the burned region');
  }
  return region;
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
    globalThis.localStorage.clear();
    // A shared link is read off the address bar, so every test starts on a bare one.
    window.history.replaceState({}, '', '/');
  });

  it('opens with the headline and the recommended apps', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(m.home_hero_line_1());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(m.home_hero_line_2());
    expect(screen.getAllByRole('button', { name: m.gen_app_remove() })).toHaveLength(BLOCKED_APPS);
  });

  it('draws no rules between the sections', async () => {
    await renderPage();
    expect(screen.queryAllByRole('separator')).toHaveLength(0);
  });

  it('opens the math on four hours a day, a quarter of the bar burned', async () => {
    await renderPage();

    expect(pick(/4h/)).toBeChecked();
    expect(screen.getByText(m.home_math_result_after(), { exact: false })).toBeInTheDocument();
    // StyleX carries a dynamic width in an inline custom property, not in
    // `style.width`, so the attribute itself is what holds the five years.
    expect(burnedRegion('5').getAttribute('style')).toContain('25%');
  });

  it('answers the question from an anchored pick', async () => {
    await renderPage();

    await userEvent.click(pick(/6h/));

    expect(pick(/6h/)).toBeChecked();
    expect(pick(/4h/)).not.toBeChecked();
    expect(screen.getByText(m.home_math_bar_years({ years: '7.5' }))).toBeInTheDocument();
  });

  it('recounts the years when the fine-tune slider moves', async () => {
    await renderPage();

    fireEvent.change(screen.getByRole('slider'), { target: { value: '6' } });

    expect(screen.getByText(m.home_math_bar_years({ years: '7.5' }))).toBeInTheDocument();
    // A value of its own is nobody's anchor, so the picks stand down.
    fireEvent.change(screen.getByRole('slider'), { target: { value: '6.5' } });
    expect(pick(/6h/)).not.toBeChecked();
  });

  it('bills more of the ledger the longer the day is', async () => {
    await renderPage();
    expect(ledgerLines()).toHaveLength(5);

    await userEvent.click(pick(/8h/));
    expect(ledgerLines()).toHaveLength(8);

    fireEvent.change(screen.getByRole('slider'), { target: { value: '1' } });
    expect(ledgerLines()).toHaveLength(2);
  });

  it('states the deal as three facts', async () => {
    await renderPage();

    expect(screen.getByText(m.home_deal_install_title())).toBeInTheDocument();
    expect(screen.getByText(m.home_deal_free_title())).toBeInTheDocument();
    expect(screen.getByText(m.home_deal_time_title())).toBeInTheDocument();
  });

  it('answers six objections', async () => {
    const { container } = await renderPage();

    expect(container.querySelectorAll('dt')).toHaveLength(6);
  });

  it('shows the search bar without any click', async () => {
    await renderPage();
    expect(searchInput()).toBeVisible();
    expect(countryButton()).toBeVisible();
  });

  it('names the hovered app in a tooltip', async () => {
    await renderPage();

    await userEvent.hover(screen.getByRole('button', { name: 'YouTube' }));

    expect(screen.getByRole('tooltip')).toHaveTextContent('YouTube');
  });

  it('picks the storefront from the country control in the search bar', async () => {
    await renderPage();
    expect(countryButton()).toHaveTextContent('United States');

    await userEvent.click(countryButton());
    await userEvent.click(screen.getByRole('option', { name: 'Türkiye' }));

    expect(countryButton()).toHaveTextContent('Türkiye');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(searchInput()).toHaveFocus();
  });

  it('filters the country list by name or code', async () => {
    await renderPage();

    await userEvent.click(countryButton());
    const filter = screen.getByLabelText(m.gen_storefront_filter());
    expect(filter).toHaveFocus();
    expect(screen.getAllByRole('option').length).toBeGreaterThan(150);

    await userEvent.type(filter, 'türk');
    expect(screen.getAllByRole('option')).toHaveLength(1);

    await userEvent.clear(filter);
    await userEvent.type(filter, 'jp');
    expect(screen.getByRole('option', { name: 'Japan' })).toBeInTheDocument();
  });

  it('resets the apps to the recommended list after a second click', async () => {
    await renderPage();
    const [first] = screen.getAllByRole('button', { name: m.gen_app_remove() });
    if (first === undefined) {
      throw new Error('The preset should render a remove button');
    }
    await userEvent.click(first);
    await userEvent.click(first);
    expect(screen.getAllByRole('button', { name: m.gen_app_remove() })).toHaveLength(
      BLOCKED_APPS - 1,
    );

    const reset = screen.getByRole('button', { name: m.gen_apps_reset() });
    await userEvent.click(reset);
    expect(reset).toHaveTextContent(m.gen_remove_confirm());
    // Arming alone changes nothing.
    expect(screen.getAllByRole('button', { name: m.gen_app_remove() })).toHaveLength(
      BLOCKED_APPS - 1,
    );

    await userEvent.click(reset);

    expect(screen.getAllByRole('button', { name: m.gen_app_remove() })).toHaveLength(BLOCKED_APPS);
    expect(reset).toHaveTextContent(m.gen_apps_reset());
  });

  it('lists nothing while the search box is empty', async () => {
    await renderPage();

    expect(screen.queryByRole('button', { name: m.gen_app_add() })).not.toBeInTheDocument();
    expect(screen.queryByText(m.gen_app_results_empty())).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: m.gen_app_search_clear() }),
    ).not.toBeInTheDocument();
  });

  it('drops the matching apps under the bar and hides them on Escape', async () => {
    await renderPage();

    await userEvent.type(searchInput(), 'exam');
    expect(await screen.findByText(SEARCH_RESULT_NAME)).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByText(SEARCH_RESULT_NAME)).not.toBeInTheDocument();
    // The query survives the dismissal; only the dropdown is gone.
    expect(searchInput()).toHaveValue('exam');
  });

  it('adds a searched app under its short name', async () => {
    await renderPage();

    await userEvent.type(searchInput(), 'exam');
    await userEvent.click(await screen.findByRole('button', { name: m.gen_app_add() }));

    expect(screen.getAllByRole('button', { name: m.gen_app_remove() })).toHaveLength(
      BLOCKED_APPS + 1,
    );
    // In the result row, in the grid and over its site chips: never the App
    // Store tagline.
    expect(screen.getAllByText(SEARCH_RESULT_NAME)).toHaveLength(3);
    expect(screen.queryByText(SEARCH_RESULT.trackName)).not.toBeInTheDocument();
  });

  it('empties the query from the clear button inside the input', async () => {
    await renderPage();

    await userEvent.type(searchInput(), 'insta');
    expect(searchInput()).toHaveValue('insta');

    await userEvent.click(screen.getByRole('button', { name: m.gen_app_search_clear() }));

    expect(searchInput()).toHaveValue('');
    expect(searchInput()).toHaveFocus();
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

  it('blocks the sites its blocked apps imply', async () => {
    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    const xml = await downloadedXml();
    expect(xml).toContain('<string>https://x.com</string>');
    expect(xml).toContain('<string>https://twitter.com</string>');
    expect(xml).toContain('<string>https://youtu.be</string>');
  });

  it('drops the sites of an app that is removed', async () => {
    await renderPage();
    const remove = removeButtonFor('com.google.ios.youtube');
    await userEvent.click(remove);
    await userEvent.click(remove);

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    expect(await downloadedXml()).not.toContain('https://youtu.be');
  });

  it('drops a derived site the user unticks', async () => {
    await renderPage();
    const site = screen.getByRole('checkbox', { name: 'x.com' });
    expect(site).toBeChecked();

    await userEvent.click(site);

    expect(screen.getByRole('checkbox', { name: 'x.com' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(await downloadedXml()).not.toContain('<string>https://x.com</string>');
  });

  it('blocks a site the user types under more sites', async () => {
    await renderPage();

    fireEvent.change(customSites(), { target: { value: 'https://news.ycombinator.com' } });

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(await downloadedXml()).toContain('<string>https://news.ycombinator.com</string>');
  });

  it('blocks the site behind a searched app', async () => {
    await renderPage();

    await userEvent.type(searchInput(), 'exam');
    await userEvent.click(await screen.findByRole('button', { name: m.gen_app_add() }));

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(await downloadedXml()).toContain('<string>https://example.com</string>');
  });

  it('keeps the urls of an older stored config that no app implies', async () => {
    globalThis.localStorage.setItem(
      'kya:config',
      JSON.stringify({
        ...presets.mert,
        webFilter: {
          deniedUrls: ['https://x.com', 'https://custom.example'],
          mode: 'deny',
          permittedUrls: [],
        },
      }),
    );

    await renderPage();

    expect(customSites().value.split('\n')).toEqual(['https://custom.example']);
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

  it('copies the shown XML and says so on the button', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: m.gen_show_xml() }));

    await userEvent.click(screen.getByRole('button', { name: m.gen_copy() }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('<plist'));
    // The copy also opens the share dialog, which holds the rest of the page
    // inert: the button underneath only answers again once it is dismissed.
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: m.gen_copied() })).toBeInTheDocument();
  });

  it('keeps the share dialog shut until a profile has left the page', async () => {
    await renderPage();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: m.share_reopen() })).not.toBeInTheDocument();
  });

  it('opens the share dialog on the download, and reopens it on request', async () => {
    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(m.share_heading_output())).toBeInTheDocument();
    expect(within(dialog).getByText(m.share_card_years({ years: '5' }))).toBeInTheDocument();
    expect(within(dialog).getByRole('link', { name: m.share_x() })).toHaveAttribute(
      'href',
      expect.stringContaining('intent/post'),
    );

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // The second click is the reader's own, so the dialog comes back.
    await userEvent.click(screen.getByRole('button', { name: m.share_reopen() }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('opens the share dialog when the XML is copied instead', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await renderPage();
    await userEvent.click(screen.getByRole('button', { name: m.gen_show_xml() }));

    await userEvent.click(screen.getByRole('button', { name: m.gen_copy() }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(globalThis.localStorage.getItem('kya:generated')).toBe('true');
  });

  it('copies the share link from the dialog', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    const dialog = await screen.findByRole('dialog');

    await userEvent.click(within(dialog).getByRole('button', { name: m.share_copy() }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('keepyourattention.com/?h=4'));
    expect(within(dialog).getByRole('button', { name: m.share_copied() })).toBeInTheDocument();
  });

  it('opens on the hours and the apps a shared link carries', async () => {
    window.history.replaceState({}, '', '/?h=6&a=ig,tt');

    await renderPage();

    expect(screen.getByText(m.home_math_bar_years({ years: '7.5' }))).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: m.gen_app_remove() })).toHaveLength(2);
    expect(screen.getByText('com.burbn.instagram')).toBeInTheDocument();
    expect(screen.getByText('com.zhiliaoapp.musically')).toBeInTheDocument();
    expect(screen.getByText(m.share_banner({ years: '7.5' }))).toBeInTheDocument();
  });

  it('keeps the shared list out of storage until the reader changes something', async () => {
    window.history.replaceState({}, '', '/?h=6&a=ig,tt');
    await renderPage();
    expect(globalThis.localStorage.getItem('kya:config')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: m.share_banner_dismiss() }));

    expect(screen.queryByText(m.share_banner({ years: '7.5' }))).not.toBeInTheDocument();
  });

  it('drops the web filter payload when the filter is turned off', async () => {
    await renderPage();
    fireEvent.click(screen.getByLabelText(m.gen_web_mode_off()));
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(await downloadedXml()).not.toContain('com.apple.webcontent-filter');
  });
});
