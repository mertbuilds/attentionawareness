import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProfile, presets } from '../lib/profile/index.ts';
import type { ProfileConfig } from '../lib/profile/index.ts';
import { m } from '../paraglide/messages.js';

// The page only needs the route factory; unit tests render the component itself.
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => options,
}));

// The screen-time clip is shot once per locale, so the tests say which locale
// the page is in. Only the answer is stubbed; the rest of the runtime stays
// real, because the message functions call into it.
const locale = vi.hoisted<{ current: 'en' | 'tr' }>(() => ({ current: 'en' }));
vi.mock(import('../paraglide/runtime.js'), async (importOriginal) => ({
  ...(await importOriginal()),
  getLocale: () => locale.current,
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

/** The identifier the signer mints, which the page only ever sees signed. */
const SIGNED_IDENTIFIER = 'com.keepyourattention.4d2f6e1a-0b7c-4c38-9a51-6f0d2b8e77c3';

// Tests stay offline. The mount-time lookup answers with nothing, so every
// blocked icon falls back to an initials tile; a search answers with one app.
// The signing route answers the way the Worker does: the posted config, built
// and stamped with the identifier only the server knows.
async function answer(input: string, init?: RequestInit): Promise<Response> {
  if (input === '/api/sign') {
    const { config } = JSON.parse(String(init?.body)) as { config: ProfileConfig };
    return new Response(
      buildProfile({
        ...config,
        displayName: 'keepyourattention',
        identifier: SIGNED_IDENTIFIER,
        lockRemoval: true,
        organization: 'keepyourattention',
      }),
      { status: 200 },
    );
  }
  const results = input.includes('/search') ? [SEARCH_RESULT] : [];
  return new Response(JSON.stringify({ resultCount: results.length, results }), { status: 200 });
}

const fetchMock = vi.fn(answer);
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

/** Step 1's gate: nothing leaves the page until this box is ticked. */
async function tickSupervised(): Promise<void> {
  await userEvent.click(screen.getByRole('checkbox', { name: m.gen_step1_check() }));
}

/** The download's own gate: the profile cannot be taken off afterwards. */
async function tickPermanent(): Promise<void> {
  await userEvent.click(screen.getByRole('checkbox', { name: m.gen_permanent_check() }));
}

/** Both gates, which is what the download asks for. */
async function tickGates(): Promise<void> {
  await tickSupervised();
  await tickPermanent();
}

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

/**
 * The add button of one search result, found through its bundle id. The
 * website box offers an add of its own, so the row is what tells them apart.
 */
function addButtonFor(bundleId: string): HTMLElement {
  const row = screen.getByText(bundleId).closest('li');
  if (row === null) {
    throw new Error(`No result row for ${bundleId}`);
  }
  return within(row as HTMLElement).getByRole('button', { name: m.gen_app_add() });
}

/** The editable host of one row of the website box. */
function siteRow(host: string): HTMLInputElement {
  return screen.getByLabelText(m.gen_web_row_edit({ site: host })) as HTMLInputElement;
}

/** The × that drops one row of the website box. */
function siteDelete(host: string): HTMLElement {
  return screen.getByRole('button', { name: m.gen_web_row_delete({ site: host }) });
}

/** The icons the profile preview draws beside its "N apps blocked" line. */
function previewFan(apps: number): HTMLElement {
  const line = screen.getByText(m.gen_summary_apps({ count: apps }));
  const fan = line.previousElementSibling;
  if (fan === null) {
    throw new Error('The apps line should follow its icons');
  }
  return fan as HTMLElement;
}

/** The speaker toggle at the end of the dial. */
function speaker(): HTMLElement {
  return screen.getByRole('button', { name: m.home_math_sound_label() });
}

/** The question mark at the end of the section question. */
function helpButton(): HTMLElement {
  return screen.getByRole('button', { name: m.home_math_help_label() });
}

/**
 * jsdom evaluates no media query of its own, and the page asks one to tell a
 * phone from a wide window: a phone gets sheets where the page gets a popover
 * and a dialog.
 */
function setViewport(kind: 'desktop' | 'phone'): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (media: string) => ({
      addEventListener: () => {},
      matches: kind === 'phone' && media === '(max-width: 639px)',
      media,
      removeEventListener: () => {},
    }),
  });
}

/** What the slider tells a screen reader at a given number of hours. */
function hoursReading(hours: number): string {
  return `${m.home_math_hours({ hours })} ${m.home_math_hours_unit()}`;
}

/** The lines of the ledger under the bar. */
function ledgerLines(): NodeListOf<HTMLLIElement> {
  const list = screen.getByRole('heading', { name: m.home_ledger_title() }).nextElementSibling;
  if (list === null) {
    throw new Error('The ledger heading should be followed by its list');
  }
  return list.querySelectorAll('li');
}

/** The sentence under the dial: the hours, and the years they take. */
function mathResult(): HTMLElement {
  return screen.getByText(m.home_math_result_hours_after(), { exact: false });
}

/** The two numbers that sentence prints in the accent colour. */
function mathNumbers(): Array<string> {
  return Array.from(mathResult().querySelectorAll('span'), (span) => span.textContent ?? '');
}

/** The file the download saved. The signer answers first, so this waits. */
async function downloadedXml(): Promise<string> {
  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  const blob = createObjectURL.mock.calls.at(-1)?.[0];
  if (blob === undefined) {
    throw new Error('Download did not create an object URL');
  }
  return blob.text();
}

describe('Generator', () => {
  beforeEach(() => {
    locale.current = 'en';
    setViewport('desktop');
    createObjectURL.mockClear();
    fetchMock.mockClear();
    fetchMock.mockImplementation(answer);
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

  it('opens the math on four hours a day, five of the next twenty years', async () => {
    await renderPage();

    expect(screen.getByRole('slider')).toHaveValue('4');
    expect(mathResult()).toHaveTextContent(
      `4${m.home_math_result_hours_between()}5${m.home_math_result_hours_after()}`,
    );
    expect(mathNumbers()).toEqual(['4', '5']);
  });

  it('marks every half hour of the travel with its own detent', async () => {
    await renderPage();
    const rail = screen.getByRole('slider').closest('div')?.parentElement;
    const marks = Array.from(rail?.querySelectorAll('div[aria-hidden="true"] > span') ?? []);

    expect(marks).toHaveLength(23);
    expect(marks.at(-1)).toHaveTextContent('12');
  });

  it('recounts the years when the slider moves', async () => {
    await renderPage();

    fireEvent.change(screen.getByRole('slider'), { target: { value: '6' } });

    expect(mathNumbers()).toEqual(['6', '7.5']);

    fireEvent.change(screen.getByRole('slider'), { target: { value: '12' } });

    expect(mathNumbers()).toEqual(['12', '15']);
  });

  it('keeps the reading on the slider, with no display beside the rail', async () => {
    await renderPage();

    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', hoursReading(4));

    fireEvent.change(screen.getByRole('slider'), { target: { value: '5.5' } });

    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', hoursReading(5.5));
    expect(screen.queryByText(m.home_math_hours_unit())).not.toBeInTheDocument();
  });

  it('bills more of the ledger the longer the day is', async () => {
    await renderPage();
    expect(ledgerLines()).toHaveLength(5);

    fireEvent.change(screen.getByRole('slider'), { target: { value: '8' } });
    expect(ledgerLines()).toHaveLength(8);

    fireEvent.change(screen.getByRole('slider'), { target: { value: '1' } });
    expect(ledgerLines()).toHaveLength(2);
  });

  it('remembers the speaker the reader turned off', async () => {
    await renderPage();
    expect(speaker()).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(speaker());

    expect(speaker()).toHaveAttribute('aria-pressed', 'false');
    expect(globalThis.localStorage.getItem('kya:sound')).toBe('false');
  });

  it('folds the screen-time helper into a question mark', async () => {
    await renderPage();

    expect(helpButton()).toHaveTextContent('?');
    expect(screen.queryByText(/screen time shows your real number/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('says where the real number lives on hover, and takes it back on Escape', async () => {
    await renderPage();

    await userEvent.hover(helpButton());

    const popover = screen.getByRole('tooltip');
    expect(within(popover).getByText(m.home_math_help_title())).toBeInTheDocument();
    expect(within(popover).getByText(m.home_math_help_body())).toBeInTheDocument();
    expect(helpButton()).toHaveAttribute('aria-describedby', popover.id);

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('plays the screen-time clip inside the popover', async () => {
    await renderPage();

    await userEvent.hover(helpButton());

    const clip = screen.getByRole('tooltip').querySelector('video');
    expect(clip).not.toBeNull();
    expect(clip?.src).toMatch(/\/media\/screentime-en\.mp4$/);
  });

  it('plays the Turkish recording to a Turkish reader', async () => {
    locale.current = 'tr';
    await renderPage();

    await userEvent.hover(helpButton());

    const clip = screen.getByRole('tooltip').querySelector('video');
    expect(clip?.src).toMatch(/\/media\/screentime-tr\.mp4$/);
  });

  it('opens the screen-time help in a sheet on a phone', async () => {
    setViewport('phone');
    await renderPage();

    await userEvent.click(helpButton());

    const sheet = await screen.findByRole('dialog');
    expect(sheet).toHaveAttribute('data-vaul-drawer');
    expect(within(sheet).getByText(m.home_math_help_title())).toBeInTheDocument();
    expect(within(sheet).getByText(m.home_math_help_body())).toBeInTheDocument();
    expect(sheet.querySelector('video')).not.toBeNull();
    // The popover is the wide page's alone.
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('states the deal as three value tiles', async () => {
    await renderPage();

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('$0')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByText(m.home_deal_apps_label())).toBeInTheDocument();
    expect(screen.getByText(m.home_deal_price_label())).toBeInTheDocument();
    expect(screen.getByText(m.home_deal_time_label())).toBeInTheDocument();
  });

  it('draws an icon for every blocked app in the profile preview', async () => {
    await renderPage();

    // The App Store answers nothing here, so every icon is the initials tile.
    expect(previewFan(BLOCKED_APPS).children).toHaveLength(BLOCKED_APPS);
  });

  it('counts the blocked apps the preview has no room for', async () => {
    globalThis.localStorage.setItem(
      'kya:config',
      JSON.stringify({
        ...presets.mert,
        blockedApps: [
          ...presets.mert.blockedApps,
          { bundleId: 'com.example.one', name: 'One' },
          { bundleId: 'com.example.two', name: 'Two' },
          { bundleId: 'com.example.three', name: 'Three' },
        ],
      }),
    );

    await renderPage();

    const fan = previewFan(BLOCKED_APPS + 3);
    expect(fan.children).toHaveLength(13);
    expect(fan.lastElementChild).toHaveTextContent('+3');
  });

  it('pills the adult filter in the profile preview once it is ticked', async () => {
    await renderPage();

    expect(screen.queryByText(m.gen_summary_adult())).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: m.gen_web_auto_filter() }));

    expect(screen.getByText(m.gen_summary_adult())).toBeInTheDocument();
  });

  it('links the repository from the footer', async () => {
    await renderPage();

    expect(screen.getByRole('link', { name: m.gen_footer_open_source_link() })).toHaveAttribute(
      'href',
      'https://github.com/mertbuilds/keepyourattention',
    );
  });

  it('signs the footer as an awareness project, linked to its builder', async () => {
    await renderPage();

    const builder = screen.getByRole('link', { name: m.gen_footer_builder() });
    expect(builder).toHaveAttribute('href', 'https://mertbuilds.com');
    // The sentence is split around the link, so the line is read off the whole
    // paragraph rather than one text node.
    expect(builder.closest('p')).toHaveTextContent(
      m.gen_footer_not_apple({ builder: m.gen_footer_builder() }),
    );
  });

  it('leads the how-it-works cards with supervision', async () => {
    await renderPage();

    expect(
      screen.getByText(m.home_step_heading({ n: 1, title: m.home_how_supervision_title() })),
    ).toBeInTheDocument();
    expect(
      screen.getByText(m.home_step_heading({ n: 4, title: m.home_how_websites_title() })),
    ).toBeInTheDocument();
  });

  it('badges nothing as needing supervision, because everything does', async () => {
    await renderPage();

    expect(screen.queryByText(/needs supervision/i)).not.toBeInTheDocument();
  });

  it('keeps the profile behind the supervision tick and the permanent one', async () => {
    await renderPage();

    expect(screen.getByRole('button', { name: m.gen_download() })).toBeDisabled();
    expect(screen.getByText(m.gen_step_gate())).toBeInTheDocument();

    await tickSupervised();

    // Supervision opens the page; the download still waits for the second tick.
    expect(screen.getByRole('button', { name: m.gen_download() })).toBeDisabled();
    expect(screen.queryByText(m.gen_step_gate())).not.toBeInTheDocument();

    await tickPermanent();

    expect(screen.getByRole('button', { name: m.gen_download() })).toBeEnabled();
    expect(globalThis.localStorage.getItem('kya:supervised')).toBe('true');
    expect(globalThis.localStorage.getItem('kya:permanent-ack')).toBe('true');
  });

  it('opens on the ticks it remembered', async () => {
    globalThis.localStorage.setItem('kya:supervised', 'true');
    globalThis.localStorage.setItem('kya:permanent-ack', 'true');

    await renderPage();

    expect(screen.getByRole('checkbox', { name: m.gen_step1_check() })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: m.gen_permanent_check() })).toBeChecked();
    expect(screen.getByRole('button', { name: m.gen_download() })).toBeEnabled();
  });

  it('locks the profile removal without asking, even on an older config', async () => {
    globalThis.localStorage.setItem(
      'kya:config',
      JSON.stringify({ ...presets.mert, lockRemoval: false }),
    );
    await renderPage();
    await tickGates();

    expect(screen.queryByText(/lock the profile/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    expect(await downloadedXml()).toContain('<key>PayloadRemovalDisallowed</key><true/>');
  });

  it('answers seven objections', async () => {
    const { container } = await renderPage();

    expect(container.querySelectorAll('dt')).toHaveLength(7);
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

    expect(screen.queryByText(SEARCH_RESULT.bundleId)).not.toBeInTheDocument();
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
    await screen.findByText(SEARCH_RESULT_NAME);
    await userEvent.click(addButtonFor(SEARCH_RESULT.bundleId));

    expect(screen.getAllByRole('button', { name: m.gen_app_remove() })).toHaveLength(
      BLOCKED_APPS + 1,
    );
    // In the result row and in the grid: never the App Store tagline.
    expect(screen.getAllByText(SEARCH_RESULT_NAME)).toHaveLength(2);
    expect(screen.queryByText(SEARCH_RESULT.trackName)).not.toBeInTheDocument();
  });

  it('empties the query from the clear button inside the input', async () => {
    await renderPage();

    await userEvent.type(searchInput(), 'insta');
    expect(searchInput()).toHaveValue('insta');

    await userEvent.click(screen.getByRole('button', { name: m.gen_app_search_clear() }));

    expect(searchInput()).toHaveValue('');
    expect(searchInput()).toHaveFocus();
    expect(screen.queryByText(SEARCH_RESULT.bundleId)).not.toBeInTheDocument();
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
    await tickGates();

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    const xml = await downloadedXml();
    expect(xml).toContain('<string>https://x.com</string>');
    expect(xml).toContain('<string>https://twitter.com</string>');
    expect(xml).toContain('<string>https://youtu.be</string>');
  });

  it('drops the sites of an app that is removed', async () => {
    await renderPage();
    await tickGates();
    const remove = removeButtonFor('com.google.ios.youtube');
    await userEvent.click(remove);
    await userEvent.click(remove);

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    expect(await downloadedXml()).not.toContain('https://youtu.be');
  });

  it('drops a derived site the user unticks', async () => {
    await renderPage();
    await tickGates();
    const site = screen.getByRole('checkbox', { name: 'x.com' });
    expect(site).toBeChecked();

    await userEvent.click(site);

    expect(screen.getByRole('checkbox', { name: 'x.com' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(await downloadedXml()).not.toContain('<string>https://x.com</string>');
  });

  it('blocks a site the reader adds in the last row of the box', async () => {
    await renderPage();
    await tickGates();

    await userEvent.type(screen.getByLabelText(m.gen_web_add_label()), 'news.ycombinator.com');
    await userEvent.keyboard('{Enter}');

    expect(siteRow('news.ycombinator.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(await downloadedXml()).toContain('<string>https://news.ycombinator.com</string>');
  });

  it('asks for a second click before deleting a site', async () => {
    await renderPage();
    await tickGates();
    const remove = siteDelete('x.com');

    await userEvent.click(remove);

    // Arming alone deletes nothing, and it never ticks the row it sits in.
    expect(remove).toHaveTextContent(m.gen_remove_confirm());
    expect(screen.getByRole('checkbox', { name: 'x.com' })).toBeChecked();

    await userEvent.click(remove);

    expect(screen.queryByRole('checkbox', { name: 'x.com' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(await downloadedXml()).not.toContain('<string>https://x.com</string>');
  });

  it('edits the host of a site the reader added', async () => {
    await renderPage();
    await tickGates();

    await userEvent.type(screen.getByLabelText(m.gen_web_add_label()), 'old.example');
    await userEvent.keyboard('{Enter}');
    const host = siteRow('old.example');
    await userEvent.clear(host);
    await userEvent.type(host, 'new.example{Enter}');

    expect(siteRow('new.example')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    const xml = await downloadedXml();
    expect(xml).toContain('<string>https://new.example</string>');
    expect(xml).not.toContain('<string>https://old.example</string>');
  });

  it('adopts the bare urls an older custom list stored', async () => {
    globalThis.localStorage.setItem(
      'kya:config',
      JSON.stringify({
        config: presets.mert,
        customSites: ['https://old.example'],
        excludedSites: [],
      }),
    );

    await renderPage();

    await tickGates();
    expect(siteRow('old.example')).toHaveValue('old.example');
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(await downloadedXml()).toContain('<string>https://old.example</string>');
  });

  it('blocks the site behind a searched app', async () => {
    await renderPage();
    await tickGates();

    await userEvent.type(searchInput(), 'exam');
    await screen.findByText(SEARCH_RESULT_NAME);
    await userEvent.click(addButtonFor(SEARCH_RESULT.bundleId));

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

    expect(siteRow('custom.example')).toBeInTheDocument();
  });

  it('downloads the profile the server signed', async () => {
    await renderPage();
    await tickGates();
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    const xml = await downloadedXml();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/sign',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(xml).toContain('com.atebits.Tweetie2');
    expect(xml).toContain('<integer>1</integer>');
    expect(xml).not.toContain('<key>ContentFilterUUID</key>');
    // The identifier is the signer's, and it is not in the page's own build.
    expect(xml).toContain(SIGNED_IDENTIFIER);
  });

  it('sends what the reader chose, and no identifier of its own', async () => {
    await renderPage();
    await tickGates();
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    await downloadedXml();
    const posted = fetchMock.mock.calls.find(([input]) => input === '/api/sign')?.[1];
    const { config } = JSON.parse(String(posted?.body)) as { config: Record<string, unknown> };
    expect(Object.keys(config).sort()).toEqual([
      'allowAppStore',
      'allowPrivateBrowsing',
      'autoFilterAdult',
      'blockedApps',
      'webFilter',
    ]);
  });

  it('keeps the button and says so when the signer is out', async () => {
    fetchMock.mockImplementation(async (input: string, init?: RequestInit) =>
      input === '/api/sign'
        ? new Response(JSON.stringify({ error: 'signing unavailable' }), { status: 503 })
        : answer(input, init),
    );
    await renderPage();
    await tickGates();

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    expect(await screen.findByText(m.gen_sign_unavailable())).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: m.gen_download() })).toBeEnabled();
  });

  it('shows what the signer turned down', async () => {
    fetchMock.mockImplementation(async (input: string, init?: RequestInit) =>
      input === '/api/sign'
        ? new Response(JSON.stringify({ error: 'bundleId "no" is not a bundle identifier' }), {
            status: 400,
          })
        : answer(input, init),
    );
    await renderPage();
    await tickGates();

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    expect(await screen.findByText('bundleId "no" is not a bundle identifier')).toBeInTheDocument();
  });

  it('calls the XML below it the unsigned source', async () => {
    await renderPage();
    await tickGates();

    await userEvent.click(screen.getByRole('button', { name: m.gen_show_xml() }));

    expect(screen.getByText(m.gen_xml_unsigned_note())).toBeInTheDocument();
  });

  it('copies the shown XML and says so on the button', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await renderPage();
    await tickGates();
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
    await tickGates();

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(m.share_heading_output())).toBeInTheDocument();
    // The card paints the number and its unit in one line but two colours, so
    // the line reads whole only from the paragraph that holds both.
    expect(
      within(dialog).getByText(
        (_, element) =>
          element?.tagName === 'P' && element.textContent === m.share_card_years({ years: '5' }),
      ),
    ).toBeInTheDocument();
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

  it('opens the share dialog on its close button, with the card fan out of reach', async () => {
    await renderPage();
    await tickGates();
    // The fan on the page itself is the interactive one, and stays that way.
    expect(screen.getByRole('button', { name: 'YouTube' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: 'YouTube' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    // The dialog moves the focus a tick after it mounts.
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus(),
    );
  });

  it('opens the share dialog when the XML is copied instead', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await renderPage();
    await tickGates();
    await userEvent.click(screen.getByRole('button', { name: m.gen_show_xml() }));

    await userEvent.click(screen.getByRole('button', { name: m.gen_copy() }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(globalThis.localStorage.getItem('kya:generated')).toBe('true');
  });

  it('copies the share link from the dialog', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await renderPage();
    await tickGates();
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    const dialog = await screen.findByRole('dialog');

    await userEvent.click(within(dialog).getByRole('button', { name: m.share_copy() }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('keepyourattention.com/?h=4'));
    expect(within(dialog).getByRole('button', { name: m.share_copied() })).toBeInTheDocument();
  });

  it('opens the share card in a sheet on a phone', async () => {
    setViewport('phone');
    await renderPage();
    await tickGates();

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    const sheet = await screen.findByRole('dialog');
    expect(sheet).toHaveAttribute('data-vaul-drawer');
    expect(within(sheet).getByText(m.share_heading_output())).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: m.share_x() })).toBeInTheDocument();
  });

  it('opens on the hours and the apps a shared link carries', async () => {
    window.history.replaceState({}, '', '/?h=6&a=ig,tt');

    await renderPage();

    expect(mathResult()).toHaveTextContent('7.5');
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
    await tickGates();
    fireEvent.click(screen.getByLabelText(m.gen_web_mode_off()));
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(await downloadedXml()).not.toContain('com.apple.webcontent-filter');
  });
});
