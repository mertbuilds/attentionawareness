import { colors } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildProfile, presets } from '../lib/profile/index.ts';
import type { ProfileConfig } from '../lib/profile/index.ts';
import { sitesForApps } from '../lib/sites.ts';
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

// The recognizer is pulled in on the first drop and is a megabyte of wasm, so
// the tests hand it the text a screenshot would have been read as instead.
const ocr = vi.hoisted(() => ({ text: '' }));
vi.mock('tesseract.js', () => ({
  createWorker: () =>
    Promise.resolve({
      recognize: () => Promise.resolve({ data: { text: ocr.text } }),
      terminate: () => Promise.resolve(),
    }),
}));

// jsdom has no object URLs, and the download path is what carries the XML out.
const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:profile');
URL.createObjectURL = createObjectURL;
URL.revokeObjectURL = vi.fn();

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
const SIGNED_IDENTIFIER = 'com.attentionawareness.4d2f6e1a-0b7c-4c38-9a51-6f0d2b8e77c3';

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
        displayName: 'attentionawareness',
        identifier: SIGNED_IDENTIFIER,
        organization: 'attentionawareness',
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
/**
 * StyleX classes are atomic and derived from the declaration itself, so the
 * same declaration compiles to the same classes here as on the page. jsdom
 * loads no stylesheet, so this is what a computed style would have said.
 */
const struck = create({ text: { color: colors.muted, textDecorationLine: 'line-through' } });

const STRUCK_CLASSES = String(props(struck.text).className).split(' ');

/** The chevron's open state is a turn, so its class is what says it turned. */
const turned = create({ chevron: { transform: 'rotate(90deg)' } });

const TURNED_CLASSES = String(props(turned.chevron).className).split(' ');

function expectStruckThrough(element: HTMLElement, yes = true): void {
  for (const name of STRUCK_CLASSES) {
    if (yes) {
      expect(element).toHaveClass(name);
    } else {
      expect(element).not.toHaveClass(name);
    }
  }
}

async function renderPage() {
  const Page = (Route as unknown as { component: React.ComponentType }).component;
  const view = render(<Page />);
  // Flush the mount-time artwork lookup so its state update stays inside act().
  await act(async () => {});
  return view;
}

const BLOCKED_APPS = presets.mert.blockedApps.length;

/** The whole recommended list plus three apps it has never heard of. */
const CROWDED_SHARE =
  '/?a=fb,ig,li,nf,pi,pv,rd,sc,th,tt,tw,x,yt,com.example.one,com.example.two,com.example.three';

/** A chip names a host, the way the preview writes it. */
const SITE_SCHEME = /^https?:\/\//u;

/**
 * What the deny list holds for the shared profile. The page derives it from
 * the blocked apps, and the crowded share carries the recommended list itself,
 * so the recommended apps are the ones to ask.
 */
function deniedSites(): ReadonlyArray<string> {
  return sitesForApps(presets.mert.blockedApps);
}

/** The download's gate: the profile cannot be taken off afterwards. */
async function tickPermanent(): Promise<void> {
  await userEvent.click(screen.getByRole('checkbox', { name: m.gen_permanent_check() }));
}

/** Trial mode: the profile stays removable, so the download asks for less. */
async function tickTrial(): Promise<void> {
  await userEvent.click(screen.getByRole('checkbox', { name: m.gen_trial_check() }));
}

/**
 * Types a host into a labelled site list and takes it with the row's own add
 * button, which is the only way a site reaches one of these lists.
 */
async function addToList(label: string, host: string): Promise<void> {
  const input = screen.getByLabelText(label);
  await userEvent.type(input, host);
  const row = input.parentElement;
  if (row === null) {
    throw new Error('The add field should sit in a row with its button');
  }
  await userEvent.click(within(row).getByRole('button', { name: m.gen_web_add_button() }));
}

/** The always-visible search field at the top of the recommended apps. */
function searchInput(): HTMLElement {
  return screen.getByLabelText(m.gen_app_search_label());
}

/** The country control inside the search bar. */
function countryButton(): HTMLElement {
  return screen.getByRole('button', { name: m.gen_storefront_label() });
}

/** The remove button of one blocked app, found through its name. */
function removeButtonFor(name: string): HTMLElement {
  const row = screen.getByText(name).closest('li');
  if (row === null) {
    throw new Error(`No blocked row for ${name}`);
  }
  return within(row as HTMLElement).getByRole('button', { name: m.gen_app_remove() });
}

/**
 * The add button of one search result, found through its name. The website box
 * offers an add of its own, so the row is what tells them apart.
 */
function addButtonFor(name: string): HTMLElement {
  const row = screen.getByText(name).closest('li');
  if (row === null) {
    throw new Error(`No result row for ${name}`);
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

/** What an iPhone says it is in Safari, and in Chrome, which borrows the name. */
const SAFARI_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const CHROME_IOS_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.6723.90 Mobile/15E148 Safari/604.1';

/** The name jsdom gives itself, which is neither Safari nor a phone. */
const realUserAgent = navigator.userAgent;

/** jsdom names itself; the install steps read the browser off this string. */
function setUserAgent(agent: string): void {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: agent });
}

/** The install steps, in the order the page lists them. */
function installSteps(): Array<string> {
  const list = screen.getByRole('heading', { name: m.gen_install_title() }).nextElementSibling;
  if (list === null) {
    throw new Error('The install heading should be followed by its steps');
  }
  return Array.from(list.querySelectorAll('li'), (step) => step.textContent ?? '');
}

/** The shorthand every browser keeps for a secure origin, and only there. */
const realRandomUuid = crypto.randomUUID;

/**
 * Safari has no `crypto.randomUUID` before 15.4, and no browser has one off a
 * secure origin: the old iPhone this profile is for is where the local build
 * has to hold up without it.
 */
function dropRandomUuid(): void {
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
}

/** What the slider tells a screen reader at a given number of hours. */
function hoursReading(hours: number): string {
  return `${m.home_math_hours({ hours })} ${m.home_math_hours_unit()}`;
}

/** The one sentence under the bar, which is the hour the dial is on. */
function truthLine(): HTMLElement {
  const line = document.querySelector('p[aria-live="polite"]');
  if (line === null) {
    throw new Error('The dial should be followed by one live line');
  }
  return line as HTMLElement;
}

/** The receipt under that line. */
function receipt(): HTMLElement {
  const box = screen.getByText(m.home_receipt_title()).parentElement?.parentElement;
  if (box === undefined || box === null) {
    throw new Error('The receipt title should sit inside the receipt');
  }
  return box;
}

/** What the receipt itemizes right now, in the order it prints the rows. */
function receiptLabels(): Array<string> {
  return within(receipt())
    .getAllByRole('listitem')
    .map((row) => row.firstElementChild?.textContent ?? '');
}

/** What one named row of the receipt says that line cost. */
function receiptValue(label: string): string {
  const row = within(receipt()).getByText(label).closest('li');
  if (row === null) {
    throw new Error(`No receipt row for ${label}`);
  }
  return row.lastElementChild?.textContent ?? '';
}

/** The number under the tear line: everything the receipt adds up to. */
function receiptTotal(): string {
  const total = within(receipt()).getByText(m.home_receipt_total_label()).nextElementSibling;
  return total?.textContent ?? '';
}

/** The two fields the question is answered in. */
function gateHours(): HTMLElement {
  return screen.getByLabelText(m.home_gate_hours());
}

function gateMinutes(): HTMLElement {
  return screen.getByLabelText(m.home_gate_minutes());
}

/** The dial is not handed over with the bill any more: this asks for it. */
function showSlider(): void {
  const button = screen.queryByRole('button', { name: m.home_gate_explore() });
  if (button !== null) {
    fireEvent.click(button);
  }
}

/** Where the builder takes a Screen Time screenshot. */
function builderDrop(): HTMLElement {
  return screen.getByRole('button', { name: m.gen_worst_drop() });
}

/** One row of the screenshot picker, found through the app it names. */
function pickerBox(name: string): HTMLElement {
  return screen.getByRole('checkbox', { name: new RegExp(name, 'u') });
}

/** Drops a screenshot on a zone, and lets the read and the lookups settle. */
async function dropScreenshot(zone: HTMLElement, text: string): Promise<void> {
  ocr.text = text;
  const file = new File(['screenshot'], 'screen-time.png', { type: 'image/png' });
  await act(async () => {
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
  });
}

/** What Screen Time says on the screen the whole feature is built around. */
const SCREENSHOT = `Screen Time
Daily Average
5h 12m
MOST USED
Instagram
2h 14m
YouTube
1h 3m
Safari
48m
WhatsApp
31m
X
22m
Duolingo
14m
`;

/** Answers the gate, which mounts the dial and starts the show. */
function answerGate(hours: string, minutes = '0'): void {
  // The fields open on the average, so an answer always writes over both.
  fireEvent.change(gateHours(), { target: { value: hours } });
  fireEvent.change(gateMinutes(), { target: { value: minutes } });
  fireEvent.click(screen.getByRole('button', { name: m.home_gate_submit() }));
}

/** One hour of the show, and the beat it holds for. */
const SHOW_STEP_MS = 900;

async function advance(ms: number): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

/**
 * The page as a shared link opens it: past the gate and past the show, with
 * the dial already the reader's. Every test about the dial itself starts here,
 * because the show is a first impression and none of them are testing it.
 */
async function renderAnswered(hours = 4) {
  window.history.replaceState({}, '', `/?h=${hours}`);
  const view = await renderPage();
  showSlider();
  return view;
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
    setUserAgent(realUserAgent);
    Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: realRandomUuid });
    createObjectURL.mockClear();
    fetchMock.mockClear();
    fetchMock.mockImplementation(answer);
    // The auto-drive tests are the only ones that run a clock or hand the page
    // an observer, and neither may outlive them.
    vi.useRealTimers();
    vi.unstubAllGlobals();
    // A shared link is read off the address bar, so every test starts on a bare one.
    window.history.replaceState({}, '', '/');
  });

  it('opens with the question the dial answers, and the recommended apps', async () => {
    await renderPage();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(m.home_hero_title());
    expect(screen.getAllByRole('button', { name: m.gen_app_remove() })).toHaveLength(BLOCKED_APPS);
  });

  it('opens on the question alone, with nothing under it to look at', async () => {
    await renderPage();

    expect(gateHours()).toBeInTheDocument();
    expect(gateMinutes()).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByText(m.home_receipt_title())).not.toBeInTheDocument();
    expect(screen.queryByText(m.home_truth_4())).not.toBeInTheDocument();
    expect(screen.queryByText(m.home_hero_product())).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: m.home_hero_cta() })).not.toBeInTheDocument();
  });

  it('opens on the average phone day, and nothing else', async () => {
    await renderPage();

    expect(gateHours()).toHaveValue('4');
    expect(gateMinutes()).toHaveValue('05');
    expect(screen.getByRole('button', { name: m.home_gate_submit() })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: m.home_gate_research() })).toBeInTheDocument();
    // The sources are one line away, not on the first screen.
    expect(screen.queryByText(m.home_research_phone_us())).not.toBeInTheDocument();
  });

  it('says where the number comes from when the research line is opened', async () => {
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: m.home_gate_research() }));

    expect(screen.getByText(m.home_research_title())).toBeInTheDocument();
    expect(screen.getByRole('link', { name: m.home_research_phone_us() })).toHaveAttribute(
      'href',
      'https://www.reviews.org/internet-service/internet-screen-time-statistics',
    );
    expect(screen.getByRole('link', { name: m.home_research_phone_world() })).toHaveAttribute(
      'href',
      'https://datareportal.com/global-digital-overview',
    );
    expect(screen.getByRole('link', { name: m.home_research_screens() })).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByText(m.home_research_title())).not.toBeInTheDocument();
  });

  it('opens the research in a sheet on a phone', async () => {
    setViewport('phone');
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: m.home_gate_research() }));

    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText(m.home_research_title())).toBeInTheDocument();
    expect(within(sheet).getAllByRole('link')).toHaveLength(3);
  });

  it('runs the show to the average when it is taken as it stands', async () => {
    vi.useFakeTimers();
    await renderPage();

    fireEvent.click(screen.getByRole('button', { name: m.home_gate_submit() }));

    expect(truthLine()).toHaveTextContent(m.home_truth_1());

    await advance(SHOW_STEP_MS * 12);

    expect(truthLine()).toHaveTextContent(m.home_truth_4());
    expect(
      within(receipt()).getByText(m.home_receipt_meta_minutes({ hours: 4, minutes: 5 })),
    ).toBeInTheDocument();
    expect(
      screen.getByText(m.home_gate_entered({ hours: 4, minutes: 5 }), { exact: false }),
    ).toBeInTheDocument();
  });

  it('runs the show to the day the reader typed over the average', async () => {
    vi.useFakeTimers();
    await renderPage();

    answerGate('3');
    await advance(SHOW_STEP_MS * 12);

    expect(truthLine()).toHaveTextContent(m.home_truth_3());
    expect(within(receipt()).getByText(m.home_receipt_meta({ hours: 3 }))).toBeInTheDocument();
  });

  it('keeps the dial out of the way until the reader asks for other hours', async () => {
    window.history.replaceState({}, '', '/?h=9');
    await renderPage();

    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(truthLine()).toHaveTextContent(m.home_truth_9());
    expect(receipt()).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: m.home_gate_explore() }));

    expect(screen.getByRole('slider')).toHaveValue('9');
    expect(screen.queryByRole('button', { name: m.home_gate_explore() })).not.toBeInTheDocument();
  });

  it('says the range back to an answer it cannot use', async () => {
    await renderPage();

    answerGate('13');

    expect(screen.getByText(m.home_gate_error())).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('asks again when the question is sent back unanswered', async () => {
    await renderPage();

    answerGate('');

    expect(screen.getByText(m.home_gate_error())).toBeInTheDocument();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });

  it('leaves the old hero lines off the page', async () => {
    await renderPage();
    expect(screen.queryByText(/more valuable than gold in 2026/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/let others monetize it/i)).not.toBeInTheDocument();
  });

  it('offers the build and the walkthrough from the hero itself', async () => {
    await renderAnswered();

    expect(screen.getByRole('link', { name: m.home_hero_cta() })).toHaveAttribute('href', '#build');
    expect(screen.getByRole('link', { name: m.home_hero_secondary() })).toHaveAttribute(
      'href',
      '#how',
    );
    expect(document.querySelector('#build')).not.toBeNull();
    expect(document.querySelector('#how')).not.toBeNull();
  });

  it('says what the thing is, right under the bill', async () => {
    await renderAnswered();
    expect(screen.getByText(m.home_hero_product())).toBeInTheDocument();
  });

  it('tells the reader why they keep failing, and what changes', async () => {
    await renderPage();

    expect(screen.getByText(m.home_why_1())).toBeInTheDocument();
    expect(screen.getByText(m.home_why_2())).toBeInTheDocument();
    expect(screen.getByText(m.home_why_3())).toBeInTheDocument();
    expect(screen.getByText(m.home_why_close())).toBeInTheDocument();
    expect(screen.getByText(m.home_changes_gone())).toBeInTheDocument();
    expect(screen.getByText(m.home_changes_stays())).toBeInTheDocument();
  });

  it('reserves no room for the walkthrough clip, which is not shot yet', async () => {
    await renderPage();
    expect(screen.queryByText(/video coming/i)).not.toBeInTheDocument();
  });

  it('tells the story in one order: why, what changes, how, the deal, proof, build', async () => {
    await renderPage();
    const headings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent ?? '');
    const landmarks = [
      m.home_why_title(),
      m.home_changes_title(),
      m.home_how_title(),
      m.home_deal_label(),
      m.home_proof_title(),
      m.gen_step1_title(),
      m.home_faq_title(),
    ].map((title) => headings.indexOf(title));

    expect(landmarks).not.toContain(-1);
    expect(landmarks).toEqual([...landmarks].sort((one, two) => one - two));
  });

  it('draws no rules between the sections', async () => {
    await renderPage();
    expect(screen.queryAllByRole('separator')).toHaveLength(0);
  });

  it('prints the bill for the day it was answered with', async () => {
    await renderAnswered();

    expect(screen.getByRole('slider')).toHaveValue('4');
    expect(truthLine()).toHaveTextContent(m.home_truth_4());
    expect(receiptTotal()).toBe(m.home_receipt_total_value({ years: '5' }));
  });

  it('marks every whole hour of the travel with its own numbered detent', async () => {
    await renderAnswered();
    const rail = screen.getByRole('slider').closest('div')?.parentElement;
    const marks = Array.from(rail?.querySelectorAll('div[aria-hidden="true"] > span') ?? []);

    expect(marks).toHaveLength(12);
    expect(marks.at(0)).toHaveTextContent('1');
    expect(marks.at(-1)).toHaveTextContent('12');
    expect(screen.getByRole('slider')).toHaveAttribute('step', '1');
  });

  it('swaps the line for the hour the dial lands on', async () => {
    await renderAnswered();

    fireEvent.change(screen.getByRole('slider'), { target: { value: '6' } });

    expect(truthLine()).toHaveTextContent(m.home_truth_6());
    expect(screen.queryByText(m.home_truth_4())).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('slider'), { target: { value: '12' } });

    expect(truthLine()).toHaveTextContent(m.home_truth_12());
    expect(screen.queryByText(m.home_truth_6())).not.toBeInTheDocument();
  });

  it('recounts the receipt when the slider moves', async () => {
    await renderAnswered();

    fireEvent.change(screen.getByRole('slider'), { target: { value: '6' } });

    expect(receiptTotal()).toBe(m.home_receipt_total_value({ years: '7.5' }));
    expect(receiptValue(m.home_receipt_money_label())).toBe('$876,000');

    fireEvent.change(screen.getByRole('slider'), { target: { value: '12' } });

    expect(receiptTotal()).toBe(m.home_receipt_total_value({ years: '15' }));
  });

  it('heads the receipt with the day it prices', async () => {
    await renderAnswered();

    expect(within(receipt()).getByText(m.home_receipt_meta({ hours: 4 }))).toBeInTheDocument();

    fireEvent.change(screen.getByRole('slider'), { target: { value: '9' } });

    expect(within(receipt()).getByText(m.home_receipt_meta({ hours: 9 }))).toBeInTheDocument();
  });

  it('keeps the reading on the slider, with no display beside the rail', async () => {
    await renderAnswered();

    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', hoursReading(4));

    fireEvent.change(screen.getByRole('slider'), { target: { value: '5' } });

    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', hoursReading(5));
    expect(screen.queryByText(m.home_math_hours_unit())).not.toBeInTheDocument();
  });

  it('bills a receipt row the moment the day earns it, and drops it again', async () => {
    await renderAnswered();
    expect(receiptLabels()).toEqual([
      m.home_receipt_books_label(),
      m.home_receipt_dinners_label(),
      m.home_receipt_languages_label(),
      m.home_receipt_money_label(),
      m.home_receipt_job_label(),
    ]);

    fireEvent.change(screen.getByRole('slider'), { target: { value: '1' } });
    expect(receiptLabels()).toEqual([m.home_receipt_books_label(), m.home_receipt_money_label()]);

    fireEvent.change(screen.getByRole('slider'), { target: { value: '3' } });
    expect(receiptLabels()).toHaveLength(4);
    expect(receiptLabels()).not.toContain(m.home_receipt_job_label());

    fireEvent.change(screen.getByRole('slider'), { target: { value: '12' } });
    expect(receiptLabels()).toHaveLength(5);
  });

  it('leaves the waking years to the total and bills a full-time job instead', async () => {
    await renderAnswered();

    fireEvent.change(screen.getByRole('slider'), { target: { value: '5' } });

    expect(receiptLabels()).not.toContain('Waking years');
    expect(receiptValue(m.home_receipt_job_label())).toBe(
      m.home_receipt_job_value({ years: '18' }),
    );
  });

  it('runs the bill up one hour at a time once the question is answered', async () => {
    vi.useFakeTimers();
    await renderPage();

    answerGate('5');

    expect(truthLine()).toHaveTextContent(m.home_truth_1());
    expect(receipt()).toBeInTheDocument();
    // Nothing is for sale until the bill has finished printing.
    expect(screen.queryByRole('link', { name: m.home_hero_cta() })).not.toBeInTheDocument();

    await advance(SHOW_STEP_MS);
    expect(truthLine()).toHaveTextContent(m.home_truth_2());

    await advance(SHOW_STEP_MS * 3);
    expect(truthLine()).toHaveTextContent(m.home_truth_5());

    await advance(SHOW_STEP_MS);
    expect(screen.getByRole('link', { name: m.home_hero_cta() })).toBeInTheDocument();
    expect(receiptTotal()).toBe(m.home_receipt_total_value({ years: '6.3' }));
  });

  it('offers neither the dial nor the gate while the show is running', async () => {
    vi.useFakeTimers();
    await renderPage();
    answerGate('5');

    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: m.home_gate_explore() })).not.toBeInTheDocument();
    // And there is no way back into the gate to answer over the top of it.
    expect(screen.queryByRole('button', { name: m.home_gate_change() })).not.toBeInTheDocument();

    await advance(SHOW_STEP_MS * 5);

    expect(screen.getByRole('button', { name: m.home_gate_change() })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: m.home_gate_explore() })).toBeInTheDocument();
  });

  it('settles on the minutes the show could not stop at', async () => {
    vi.useFakeTimers();
    await renderPage();

    answerGate('5', '30');
    await advance(SHOW_STEP_MS * 5);

    expect(truthLine()).toHaveTextContent(m.home_truth_5());
    expect(
      within(receipt()).getByText(m.home_receipt_meta_minutes({ hours: 5, minutes: 30 })),
    ).toBeInTheDocument();
    expect(
      screen.getByText(m.home_gate_entered({ hours: 5, minutes: 30 }), { exact: false }),
    ).toBeInTheDocument();
  });

  it('gives a day under an hour one beat and nothing to climb', async () => {
    vi.useFakeTimers();
    await renderPage();

    answerGate('1');
    expect(truthLine()).toHaveTextContent(m.home_truth_1());

    await advance(SHOW_STEP_MS);
    expect(screen.getByRole('link', { name: m.home_hero_cta() })).toBeInTheDocument();
  });

  it('leaves the dial where a shared link put it, with no show to sit through', async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/?h=9');
    await renderPage();
    showSlider();

    expect(screen.getByRole('slider')).toHaveValue('9');
    expect(screen.getByRole('link', { name: m.home_hero_cta() })).toBeInTheDocument();

    await advance(SHOW_STEP_MS * 12);

    expect(screen.getByRole('slider')).toHaveValue('9');
  });

  it('opens on the exact day a link carries in minutes', async () => {
    window.history.replaceState({}, '', '/?m=330');
    await renderPage();
    showSlider();

    expect(screen.getByRole('slider')).toHaveValue('5');
    expect(
      within(receipt()).getByText(m.home_receipt_meta_minutes({ hours: 5, minutes: 30 })),
    ).toBeInTheDocument();
    expect(receiptTotal()).toBe(m.home_receipt_total_value({ years: '6.9' }));
  });

  it('reopens the gate on request, and runs no second show', async () => {
    vi.useFakeTimers();
    await renderAnswered(5);

    fireEvent.click(screen.getByRole('button', { name: m.home_gate_change() }));
    answerGate('9');

    expect(screen.getByRole('slider')).toHaveValue('9');
    expect(screen.getByRole('slider')).not.toHaveAttribute('aria-disabled');

    await advance(SHOW_STEP_MS * 12);

    expect(screen.getByRole('slider')).toHaveValue('9');
  });

  it('turns the detent clicks off from the speaker', async () => {
    await renderAnswered();
    expect(speaker()).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(speaker());

    expect(speaker()).toHaveAttribute('aria-pressed', 'false');
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
    window.history.replaceState({}, '', CROWDED_SHARE);

    await renderPage();

    const fan = previewFan(BLOCKED_APPS + 3);
    // Twelve icons and the pill that counts the rest.
    expect(fan.children).toHaveLength(13);
    expect(fan.lastElementChild).toHaveTextContent(`+${BLOCKED_APPS + 3 - 12}`);
  });

  it('writes out every blocked app behind that count', async () => {
    window.history.replaceState({}, '', CROWDED_SHARE);

    await renderPage();

    const fan = previewFan(BLOCKED_APPS + 3);
    const more = within(fan as HTMLElement).getByRole('button');
    await userEvent.click(more);

    const list = screen.getByRole('tooltip');
    expect(within(list).getByText(m.gen_preview_all_apps_title())).toBeInTheDocument();
    for (const app of presets.mert.blockedApps) {
      expect(within(list).getByText(app.name)).toBeInTheDocument();
    }
  });

  it('keeps that list open while the pointer works inside it', async () => {
    window.history.replaceState({}, '', CROWDED_SHARE);

    await renderPage();

    const fan = previewFan(BLOCKED_APPS + 3);
    const more = within(fan as HTMLElement).getByRole('button');
    await userEvent.hover(more);

    // A press inside the box: a word being selected, or its scrollbar dragged.
    // The box is portalled onto the body, so it is not the pill's own subtree.
    const list = screen.getByRole('tooltip');
    fireEvent.pointerDown(within(list).getByText(m.gen_preview_all_apps_title()));

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    // That press blurs the pill, and the focus it hands over lands in the box.
    fireEvent.blur(more, { relatedTarget: list });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    // Focus that leaves the pair is the one that closes it.
    fireEvent.blur(more, { relatedTarget: document.body });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('writes out every blocked site behind the count the chips stop at', async () => {
    window.history.replaceState({}, '', CROWDED_SHARE);

    await renderPage();

    const sites = deniedSites();
    const summary = screen.getByText(m.gen_summary_sites_blocked({ count: sites.length }));
    const more = within(summary.parentElement as HTMLElement).getByRole('button');
    await userEvent.click(more);

    const list = screen.getByRole('tooltip');
    expect(within(list).getByText(m.gen_preview_all_sites_title())).toBeInTheDocument();
    for (const site of sites) {
      expect(within(list).getByText(site.replace(SITE_SCHEME, ''))).toBeInTheDocument();
    }
  });

  it('pills the adult filter in the profile preview, and drops it when unticked', async () => {
    await renderPage();

    expect(screen.getByText(m.gen_summary_adult())).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: m.gen_web_auto_filter() }));

    expect(screen.queryByText(m.gen_summary_adult())).not.toBeInTheDocument();
  });

  it('pills the profile as locked, and as removable in trial mode', async () => {
    await renderPage();

    expect(screen.getByText(m.gen_summary_locked_on())).toBeInTheDocument();

    await tickTrial();

    expect(screen.getByText(m.gen_summary_locked_off())).toBeInTheDocument();
    expect(screen.queryByText(m.gen_summary_locked_on())).not.toBeInTheDocument();
  });

  it('links the repository from the footer', async () => {
    await renderPage();

    expect(screen.getByRole('link', { name: m.gen_footer_open_source_link() })).toHaveAttribute(
      'href',
      'https://github.com/mertbuilds/attentionawareness',
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

  it('keeps the profile behind the permanent tick', async () => {
    await renderPage();

    expect(screen.getByRole('button', { name: m.gen_download() })).toBeDisabled();

    await tickPermanent();

    expect(screen.getByRole('button', { name: m.gen_download() })).toBeEnabled();
  });

  it('hands over a locked profile unless trial mode is on', async () => {
    await renderPage();
    await tickPermanent();

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    expect(await downloadedXml()).toContain('<key>PayloadRemovalDisallowed</key><true/>');
  });

  it('asks for no permanence tick in trial mode, and says which profile it hands over', async () => {
    await renderPage();
    await tickTrial();

    expect(
      screen.queryByRole('checkbox', { name: m.gen_permanent_check() }),
    ).not.toBeInTheDocument();
    const download = screen.getByRole('button', { name: m.gen_download_trial() });
    expect(download).toBeEnabled();

    fireEvent.click(download);

    expect(await downloadedXml()).toContain('<key>PayloadRemovalDisallowed</key><false/>');
  });

  it('asks for the permanence tick again when trial mode goes back off', async () => {
    await renderPage();
    await tickTrial();
    await tickTrial();

    expect(screen.getByRole('checkbox', { name: m.gen_permanent_check() })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: m.gen_download() })).toBeDisabled();

    await tickPermanent();

    expect(screen.getByRole('button', { name: m.gen_download() })).toBeEnabled();
  });

  it('answers nine objections', async () => {
    const { container } = await renderPage();

    expect(container.querySelectorAll('dt')).toHaveLength(9);
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

    expect(screen.queryByText(SEARCH_RESULT_NAME)).not.toBeInTheDocument();
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
    await userEvent.click(addButtonFor(SEARCH_RESULT_NAME));

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
    expect(screen.queryByText(SEARCH_RESULT_NAME)).not.toBeInTheDocument();
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
    await tickPermanent();

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    const xml = await downloadedXml();
    expect(xml).toContain('<string>https://x.com</string>');
    expect(xml).toContain('<string>https://twitter.com</string>');
    expect(xml).toContain('<string>https://youtu.be</string>');
  });

  it('drops the sites of an app that is removed', async () => {
    await renderPage();
    await tickPermanent();
    const remove = removeButtonFor('YouTube');
    await userEvent.click(remove);
    await userEvent.click(remove);

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    expect(await downloadedXml()).not.toContain('https://youtu.be');
  });

  it('drops a derived site the user unticks', async () => {
    await renderPage();
    await tickPermanent();
    const site = screen.getByRole('checkbox', { name: 'x.com' });
    expect(site).toBeChecked();

    await userEvent.click(site);

    expect(screen.getByRole('checkbox', { name: 'x.com' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(await downloadedXml()).not.toContain('<string>https://x.com</string>');
  });

  it('blocks a site the reader adds in the last row of the box', async () => {
    await renderPage();
    await tickPermanent();

    await userEvent.type(screen.getByLabelText(m.gen_web_add_label()), 'news.ycombinator.com');
    await userEvent.keyboard('{Enter}');

    expect(siteRow('news.ycombinator.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(await downloadedXml()).toContain('<string>https://news.ycombinator.com</string>');
  });

  it('asks for a second click before deleting a site', async () => {
    await renderPage();
    await tickPermanent();
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
    await tickPermanent();

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

  it('blocks the site behind a searched app', async () => {
    await renderPage();
    await tickPermanent();

    await userEvent.type(searchInput(), 'exam');
    await screen.findByText(SEARCH_RESULT_NAME);
    await userEvent.click(addButtonFor(SEARCH_RESULT_NAME));

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(await downloadedXml()).toContain('<string>https://example.com</string>');
  });

  it('downloads the profile the server signed', async () => {
    await renderPage();
    await tickPermanent();
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
    await tickPermanent();
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    await downloadedXml();
    const posted = fetchMock.mock.calls.find(([input]) => input === '/api/sign')?.[1];
    const { config } = JSON.parse(String(posted?.body)) as { config: Record<string, unknown> };
    expect(Object.keys(config).sort()).toEqual([
      'allowAppStore',
      'allowPrivateBrowsing',
      'autoFilterAdult',
      'blockedApps',
      'lockRemoval',
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
    await tickPermanent();

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
    await tickPermanent();

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    expect(await screen.findByText('bundleId "no" is not a bundle identifier')).toBeInTheDocument();
  });

  it('keeps the share dialog shut until a profile has left the page', async () => {
    await renderPage();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: m.share_reopen() })).not.toBeInTheDocument();
  });

  it('opens the share dialog on the download, and reopens it on request', async () => {
    await renderPage();
    await tickPermanent();

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
    await tickPermanent();
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

  it('copies the share link from the dialog', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await renderPage();
    await tickPermanent();
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    const dialog = await screen.findByRole('dialog');

    await userEvent.click(within(dialog).getByRole('button', { name: m.share_copy() }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('attentionawareness.com/?h=4'));
    expect(within(dialog).getByRole('button', { name: m.share_copied() })).toBeInTheDocument();
  });

  it('opens the share card in a sheet on a phone', async () => {
    setViewport('phone');
    await renderPage();
    await tickPermanent();

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    const sheet = await screen.findByRole('dialog');
    expect(sheet).toHaveAttribute('data-vaul-drawer');
    expect(within(sheet).getByText(m.share_heading_output())).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: m.share_x() })).toBeInTheDocument();
  });

  it('opens the download on both ticks on a phone with no randomUUID', async () => {
    setViewport('phone');
    dropRandomUuid();
    await renderPage();

    expect(screen.getByRole('button', { name: m.gen_download() })).toBeDisabled();

    await tickPermanent();

    expect(screen.getByRole('button', { name: m.gen_download() })).toBeEnabled();
  });

  it('shares from the phone sheet after the download, and reopens it', async () => {
    setViewport('phone');
    dropRandomUuid();
    await renderPage();
    await tickPermanent();

    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    expect(await screen.findByRole('dialog')).toHaveAttribute('data-vaul-drawer');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: m.share_reopen() }));

    expect(await screen.findByRole('dialog')).toHaveAttribute('data-vaul-drawer');
  });

  it('opens on the hours and the apps a shared link carries', async () => {
    window.history.replaceState({}, '', '/?h=6&a=ig,tt');

    await renderPage();
    showSlider();

    expect(screen.getByRole('slider')).toHaveValue('6');
    expect(truthLine()).toHaveTextContent(m.home_truth_6());
    expect(receiptTotal()).toBe(m.home_receipt_total_value({ years: '7.5' }));
    expect(screen.getAllByRole('button', { name: m.gen_app_remove() })).toHaveLength(2);
    expect(screen.getByText('Instagram')).toBeInTheDocument();
    expect(screen.getByText('TikTok')).toBeInTheDocument();
    expect(screen.getByText(m.share_banner({ years: '7.5' }))).toBeInTheDocument();
  });

  it('takes down the banner a shared link raised', async () => {
    window.history.replaceState({}, '', '/?h=6&a=ig,tt');
    await renderPage();

    await userEvent.click(screen.getByRole('button', { name: m.share_banner_dismiss() }));

    expect(screen.queryByText(m.share_banner({ years: '7.5' }))).not.toBeInTheDocument();
  });

  it('sends the file to the phone when the page is open on a desktop', async () => {
    await renderPage();

    expect(installSteps()).toEqual([
      m.gen_install_desktop_1(),
      m.gen_install_desktop_2(),
      m.gen_install_desktop_3(),
    ]);
  });

  it('installs in two steps in Safari on a phone', async () => {
    setViewport('phone');
    setUserAgent(SAFARI_AGENT);

    await renderPage();

    expect(installSteps()).toEqual([m.gen_install_safari_1(), m.gen_install_safari_2()]);
  });

  it('goes through Files on a phone in another browser', async () => {
    setViewport('phone');
    setUserAgent(CHROME_IOS_AGENT);

    await renderPage();

    expect(installSteps()).toEqual([
      m.gen_install_other_1(),
      m.gen_install_other_2(),
      m.gen_install_other_3(),
    ]);
  });

  it('strikes a blocklist row out when it is unticked', async () => {
    await renderPage();
    const site = 'instagram.com';
    // The same host is also a chip in the preview, so this asks the row itself.
    const row = screen.getByRole('checkbox', { name: site }).parentElement;
    if (row === null) {
      throw new Error('A site checkbox should sit in its row');
    }
    const line = within(row).getByText(site);

    expectStruckThrough(line, false);

    await userEvent.click(screen.getByRole('checkbox', { name: site }));

    expectStruckThrough(line);
  });

  it('keeps an unticked exception listed and out of the profile', async () => {
    await renderPage();
    await tickPermanent();

    await addToList(m.gen_web_permitted_label(), 'example.com');
    await userEvent.click(screen.getByRole('checkbox', { name: 'example.com' }));
    expectStruckThrough(screen.getByText('example.com'));
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    expect(await downloadedXml()).not.toContain('<string>https://example.com</string>');
  });

  it('takes an exception through the same row the blocklist uses', async () => {
    await renderPage();
    await tickPermanent();

    await addToList(m.gen_web_permitted_label(), 'example.com');
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    const xml = await downloadedXml();
    expect(xml).toContain('<key>PermittedURLs</key>');
    expect(xml).toContain('<string>https://example.com</string>');
  });

  it('drops an exception on the second click of its ×', async () => {
    await renderPage();
    await tickPermanent();

    await addToList(m.gen_web_permitted_label(), 'example.com');
    const site = 'example.com';
    await userEvent.click(screen.getByRole('button', { name: m.gen_web_row_delete({ site }) }));
    await userEvent.click(
      screen.getByRole('button', { name: m.gen_web_row_delete_confirm({ site }) }),
    );
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    expect(await downloadedXml()).not.toContain('<string>https://example.com</string>');
  });

  it('takes an allowed site through the same row in allow mode', async () => {
    await renderPage();
    await tickPermanent();
    fireEvent.click(screen.getByLabelText(m.gen_web_mode_allow()));

    await addToList(m.gen_web_allowed_label(), 'wikipedia.org');
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    const xml = await downloadedXml();
    expect(xml).toContain('<key>AllowListBookmarks</key>');
    expect(xml).toContain('<string>https://wikipedia.org</string>');
  });

  it('folds private browsing away under more settings, ticked and closed', async () => {
    await renderPage();
    const box = screen.getByRole('checkbox', { name: m.gen_web_private_browsing() });
    const details = box.closest('details');

    // jsdom draws nothing, so `open` is what says the rows are folded away.
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(box).toBeChecked();

    await userEvent.click(screen.getByText(m.gen_more_settings()));

    expect(details).toHaveAttribute('open');
  });

  it('turns the chevron when more settings opens', async () => {
    await renderPage();
    const summary = screen.getByText(m.gen_more_settings());
    const chevron = summary.querySelector('svg');

    expect(chevron).not.toBeNull();
    for (const name of TURNED_CLASSES) {
      expect(chevron).not.toHaveClass(name);
    }

    await userEvent.click(summary);

    expect(summary.closest('details')).toHaveAttribute('open');
    await waitFor(() => {
      for (const name of TURNED_CLASSES) {
        expect(chevron).toHaveClass(name);
      }
    });
  });

  it('keeps the App Store under more settings, ticked', async () => {
    await renderPage();
    const box = screen.getByRole('checkbox', { name: m.gen_allow_app_store() });

    expect(box.closest('details')).not.toBeNull();
    expect(box).toBeChecked();
  });

  it('takes the App Store away when the reader unticks it', async () => {
    await renderPage();
    await tickPermanent();

    await userEvent.click(screen.getByRole('checkbox', { name: m.gen_allow_app_store() }));
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));

    expect(await downloadedXml()).toContain('<key>allowAppInstallation</key><false/>');
  });

  it('drops the web filter payload when the filter is turned off', async () => {
    await renderPage();
    await tickPermanent();
    fireEvent.click(screen.getByLabelText(m.gen_web_mode_off()));
    fireEvent.click(screen.getByRole('button', { name: m.gen_download() }));
    expect(await downloadedXml()).not.toContain('com.apple.webcontent-filter');
  });
  describe('the screenshot picker', () => {
    it('offers the reader their own Screen Time list at the top of the builder', async () => {
      await renderPage();

      expect(screen.getByText(m.gen_worst_title())).toBeInTheDocument();
      expect(screen.getByText(m.gen_worst_step_1())).toBeInTheDocument();
      expect(screen.getByText(m.gen_worst_privacy())).toBeInTheDocument();
      expect(builderDrop()).toBeInTheDocument();
    });

    it('reads a dropped screenshot into a picker of the apps it named', async () => {
      await renderPage();

      await dropScreenshot(builderDrop(), SCREENSHOT);

      expect(await screen.findByText(m.gen_worst_found())).toBeInTheDocument();
      expect(pickerBox('Instagram')).toBeChecked();
      expect(pickerBox('YouTube')).toBeChecked();
      expect(pickerBox('^X')).toBeChecked();
      // Apple's own app cannot be hidden, and the one a day needs is listed
      // but not ticked.
      expect(pickerBox('Safari')).toBeDisabled();
      expect(pickerBox('Safari')).not.toBeChecked();
      expect(pickerBox('WhatsApp')).not.toBeChecked();
      expect(screen.getByText(m.gen_worst_system())).toBeInTheDocument();
      expect(screen.getByText(m.gen_worst_keep())).toBeInTheDocument();
      // The duration the screenshot showed stays beside the app it belongs to.
      expect(screen.getByText('2h 14m')).toBeInTheDocument();
    });

    it('offers the recommended apps the screenshot did not name, ticked', async () => {
      await renderPage();

      await dropScreenshot(builderDrop(), SCREENSHOT);
      await screen.findByText(m.gen_worst_found());

      expect(screen.getByText(m.gen_worst_recommended())).toBeInTheDocument();
      expect(pickerBox('Threads')).toBeChecked();
    });

    it('blocks what was ticked, and lists nothing the profile already carries twice', async () => {
      await renderPage();

      await dropScreenshot(builderDrop(), SCREENSHOT);
      await screen.findByText(m.gen_worst_found());
      fireEvent.click(screen.getByRole('button', { name: m.gen_worst_apply() }));

      // Everything but the one app the recommended list had never heard of is
      // already in it, so the list grows by exactly that app.
      expect(screen.getAllByRole('button', { name: m.gen_app_remove() })).toHaveLength(
        BLOCKED_APPS + 1,
      );
      expect(screen.getByText(SEARCH_RESULT_NAME)).toBeInTheDocument();
      expect(
        screen.getByText(m.gen_worst_summary({ count: BLOCKED_APPS + 1 }), { exact: false }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: m.gen_worst_apply() })).not.toBeInTheDocument();
    });

    it('takes the block back for a second screenshot', async () => {
      await renderPage();

      await dropScreenshot(builderDrop(), SCREENSHOT);
      await screen.findByText(m.gen_worst_found());
      fireEvent.click(screen.getByRole('button', { name: m.gen_worst_apply() }));
      fireEvent.click(screen.getByRole('button', { name: m.gen_worst_rescan() }));

      expect(builderDrop()).toBeInTheDocument();
    });

    it('takes a screenshot pasted while the zone has the focus', async () => {
      await renderPage();
      ocr.text = SCREENSHOT;
      const file = new File(['screenshot'], 'screen-time.png', { type: 'image/png' });

      await act(async () => {
        builderDrop().focus();
      });
      await act(async () => {
        fireEvent.paste(document, { clipboardData: { files: [file] } });
      });

      expect(await screen.findByText(m.gen_worst_found())).toBeInTheDocument();
    });

    it('hands a name it found nothing for to the search bar', async () => {
      fetchMock.mockImplementation(async (input: string, init?: RequestInit) =>
        input.includes('/search') ? new Response('', { status: 500 }) : answer(input, init),
      );
      await renderPage();

      await dropScreenshot(builderDrop(), 'MOST USED\nDuolingo\n14m');

      const unknown = await screen.findByRole('button', { name: m.gen_worst_unknown() });
      fireEvent.click(unknown);

      expect(searchInput()).toHaveValue('Duolingo');
    });

    it('says so when there is no list on the screenshot', async () => {
      await renderPage();

      await dropScreenshot(builderDrop(), 'Screen Time\nSHOW CATEGORIES');

      expect(screen.getByText(m.gen_worst_failed())).toBeInTheDocument();
      expect(builderDrop()).toBeInTheDocument();
    });

    it('leaves the recommended list alone when the screenshot is skipped', async () => {
      await renderPage();

      fireEvent.click(screen.getByRole('button', { name: m.gen_worst_skip() }));

      expect(screen.queryByRole('button', { name: m.gen_worst_drop() })).not.toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: m.gen_app_remove() })).toHaveLength(
        BLOCKED_APPS,
      );
    });
  });
});
