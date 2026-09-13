import { foldName, knownAppNames } from './known-apps.ts';

/** One row of the Most Used list: the app, and how long it was used for. */
export type ScreenTimeEntry = {
  name: string;
  /** The duration as the screenshot wrote it, when the line carried one. */
  time?: string | undefined;
};

/** A day as Screen Time reports it, in whole hours and the minutes past them. */
export type DailyAverage = { hours: number; minutes: number };

/** Everything one screenshot was read for. */
export type ScreenTimeRead = {
  average: DailyAverage | null;
  entries: Array<ScreenTimeEntry>;
};

/** Screen Time lists the worst apps first, and nobody blocks the tail of it. */
const MAX_ENTRIES = 8;
/** An app name is short. Anything longer is a sentence OCR ran together. */
const MAX_NAME_LENGTH = 30;
/** Above this the phone's own pixels cost recognition time and buy no accuracy. */
const MAX_EDGE = 1600;
const PERCENT = 100;
const MINUTES_PER_HOUR = 60;

/**
 * What the reader is looking at while the screenshot is read. Loading the
 * language data is its own phase and reports its own progress, so only the
 * recognition itself drives the line.
 */
const RECOGNIZING = 'recognizing text';

/**
 * The units a duration is written in, longest first so `saat` is never read as
 * `sa` with letters left over. Seconds are listed because a row can fall under
 * a minute, and a line made only of these is a duration, not an app.
 */
const HOURS = 'hours?|hrs?|h|saat|sa';
const MINUTES = 'minutes?|mins?|m|dakika|dk';
const SECONDS = 'seconds?|secs?|s|saniye|sn';
/** A unit binds to its own number and nothing else: `5 hafta` is not 5 hours. */
const UNIT_END = String.raw`(?![\p{L}\p{N}])`;
const DURATION = String.raw`(?:\d+\s*(?:${HOURS}|${MINUTES}|${SECONDS})${UNIT_END}\.?\s*)+`;
/** The clock form the summary sometimes takes: `5:12`. */
const CLOCK = String.raw`\d{1,2}\s*[:.]\s*\d{2}`;
const HOURS_PATTERN = new RegExp(String.raw`(\d+)\s*(?:${HOURS})${UNIT_END}`, 'iu');
const MINUTES_PATTERN = new RegExp(String.raw`(\d+)\s*(?:${MINUTES})${UNIT_END}`, 'iu');
const CLOCK_PATTERN = new RegExp(String.raw`(\d{1,2})\s*[:.]\s*(\d{2})`, 'u');
/** The duration at the end of a row, with whatever separated it from the name. */
const TRAILING_TIME = new RegExp(String.raw`[\s,.·•|]*(${DURATION}|${CLOCK})$`, 'iu');
/** What labels the number the whole first screen is about. */
const AVERAGE_LABEL = /(?:daily\s*average|g[uü]nl[uü]k\s*ortalama)\s*:?\s*/iu;
/** An app name starts on a letter or a digit and holds no punctuation soup. */
const NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} '&+.:!?-]*$/u;
const LETTERS = /\p{L}/gu;

/**
 * What Screen Time writes around the list, in both languages the site speaks.
 * These are folded keys, so case, spacing and Turkish diacritics are already
 * out of them.
 */
const HEADINGS: ReadonlySet<string> = new Set([
  'apps',
  'categories',
  'websites',
  'limits',
  'notifications',
  'pickups',
  'week',
  'day',
  'today',
  'yesterday',
  'mostused',
  'showcategories',
  'showapps',
  'showmore',
  'showless',
  'screentime',
  'dailyaverage',
  'total',
  'totalscreentime',
  'seeallappwebsiteactivity',
  'appwebsiteactivity',
  'uygulamalar',
  'kategoriler',
  'websiteleri',
  'sinirlar',
  'bildirimler',
  'eldealmalar',
  'hafta',
  'gun',
  'bugun',
  'dun',
  'encokkullanilan',
  'kategorilerigoster',
  'uygulamalarigoster',
  'ekransuresi',
  'gunlukortalama',
  'toplam',
  'tumuygulamavewebsitesietkinligi',
]);

/**
 * Screen Time's own chrome, as it reads when a line carries more than one
 * thing: a wide row puts "MOST USED" and "SHOW CATEGORIES" on the same line,
 * and a summary line carries its label and its figure. These are distinctive
 * enough that a line holding one anywhere is not an app.
 */
const HEADING_MARKS: ReadonlyArray<string> = [
  'mostused',
  'showcategories',
  'showapps',
  'showmore',
  'dailyaverage',
  'screentime',
  'totalscreentime',
  'seeall',
  'appwebsiteactivity',
  'updatedtoday',
  'encokkullanilan',
  'kategorilerigoster',
  'uygulamalarigoster',
  'gunlukortalama',
  'ekransuresi',
  'tumuygulama',
  'guncellendi',
];

/**
 * What OCR reads one letter as when it is really another: a capital I as a
 * lowercase l, an O as a zero. Folding both the read name and the known one
 * through the same table is what makes "lnstagram" Instagram.
 */
const CONFUSIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/rn/gu, 'm'],
  [/vv/gu, 'w'],
  [/[l1]/gu, 'i'],
  [/0/gu, 'o'],
  [/5/gu, 's'],
  [/8/gu, 'b'],
];

/** The apps a one-letter name can be. Everything else that short is noise. */
const SHORT_NAMES: ReadonlySet<string> = new Set(
  knownAppNames.filter((name) => name.length === 1).map((name) => foldName(name)),
);

const FUZZY_NAMES = new Map(knownAppNames.map((name) => [confuse(name), name]));

/** A name folded the whole way down: no case, no diacritics, no OCR confusions. */
function confuse(name: string): string {
  let key = foldName(name);
  for (const [pattern, letter] of CONFUSIONS) {
    key = key.replace(pattern, letter);
  }
  return key;
}

/**
 * The apps a Screen Time screenshot lists, worst first. Names are what the
 * list is read for: the durations beside them are shown back to the reader but
 * never decide anything, because OCR gets a name right far more often than it
 * gets a two-digit number right.
 */
export function pickAppNames(text: string): Array<string> {
  return pickAppEntries(text).map((entry) => entry.name);
}

/** The same rows, with the duration each line carried where it carried one. */
export function pickAppEntries(text: string): Array<ScreenTimeEntry> {
  const lines = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const entries: Array<ScreenTimeEntry> = [];
  const seen = new Set<string>();

  for (const [index, line] of lines.entries()) {
    if (entries.length === MAX_ENTRIES) {
      break;
    }
    const row = readRow(line);
    if (row === null) {
      continue;
    }
    const key = confuse(row.name);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    // Screen Time puts the duration on the name's own line or on the next one,
    // depending on how wide the row is.
    const time = row.time ?? timeOnly(lines[index + 1]);
    entries.push(time === null ? { name: row.name } : { name: row.name, time });
  }
  return entries;
}

/**
 * The number the hero asks for, read off the screenshot instead: the daily
 * average, wherever Screen Time labelled it. Nothing labelled is nothing
 * answered, and the reader types it themselves.
 */
export function pickDailyAverage(text: string): DailyAverage | null {
  const lines = text.split(/\r?\n/u).map((line) => line.trim());
  for (const [index, line] of lines.entries()) {
    const label = AVERAGE_LABEL.exec(line);
    if (label === null) {
      continue;
    }
    const after = line.slice(label.index + label[0].length);
    const average = duration(after) ?? duration(lines[index + 1] ?? '');
    if (average !== null) {
      return average;
    }
  }
  return null;
}

/**
 * A screenshot, read in the browser and nowhere else. Tesseract is pulled in
 * on the first drop, so the landing page carries none of it; the image is
 * scaled down and drained of colour first, which is the whole of the
 * pre-processing that pays for itself on a phone screenshot.
 */
export async function readScreenshot(
  file: Blob,
  onProgress?: (percent: number) => void,
): Promise<ScreenTimeRead> {
  const image = await prepareImage(file);
  const { createWorker } = await import('tesseract.js');
  // English alone: Screen Time lists app names, and an app is called the same
  // thing in every storefront.
  const worker = await createWorker('eng', undefined, {
    logger: (message) => {
      if (message.status === RECOGNIZING) {
        onProgress?.(Math.round(message.progress * PERCENT));
      }
    },
  });
  try {
    const { data } = await worker.recognize(image);
    return { average: pickDailyAverage(data.text), entries: pickAppEntries(data.text) };
  } finally {
    await worker.terminate();
  }
}

/** The duration a string holds, in either notation, or nothing. */
function duration(text: string): DailyAverage | null {
  const clock = CLOCK_PATTERN.exec(text);
  if (clock?.[1] !== undefined && clock[2] !== undefined) {
    const minutes = Number(clock[2]);
    if (minutes < MINUTES_PER_HOUR) {
      return { hours: Number(clock[1]), minutes };
    }
  }
  const hours = HOURS_PATTERN.exec(text);
  const minutes = MINUTES_PATTERN.exec(text);
  if (hours?.[1] === undefined && minutes?.[1] === undefined) {
    return null;
  }
  return {
    hours: hours?.[1] === undefined ? 0 : Number(hours[1]),
    minutes: minutes?.[1] === undefined ? 0 : Number(minutes[1]),
  };
}

/** One line as a row of the list: the app it names, and the time beside it. */
function readRow(line: string): { name: string; time: string | null } | null {
  const trailing = TRAILING_TIME.exec(line);
  const time = trailing?.[1]?.trim() ?? null;
  const name = appName(trailing === null ? line : line.slice(0, trailing.index));
  return name === null ? null : { name, time };
}

/** A line that is nothing but a duration, which is the row above's time. */
function timeOnly(line: string | undefined): string | null {
  if (line === undefined) {
    return null;
  }
  const trailing = TRAILING_TIME.exec(line);
  if (trailing === null || line.slice(0, trailing.index).trim() !== '') {
    return null;
  }
  return trailing[1]?.trim() ?? null;
}

/**
 * The app a line names, corrected to what it is really called when the read is
 * close enough to a name we know. A heading, a number, or a line too long to
 * be a name is not an app.
 */
function appName(text: string): string | null {
  const name = text
    .trim()
    .replaceAll(/[\s·•|]+/gu, ' ')
    .replace(/[,.·•|]+$/u, '')
    .trim();
  if (name === '' || name.length > MAX_NAME_LENGTH || !NAME_PATTERN.test(name)) {
    return null;
  }
  const key = foldName(name);
  if (HEADINGS.has(key) || HEADING_MARKS.some((mark) => key.includes(mark))) {
    return null;
  }
  const letters = name.match(LETTERS)?.length ?? 0;
  if (letters === 0 || (letters === 1 && !SHORT_NAMES.has(key))) {
    return null;
  }
  return FUZZY_NAMES.get(confuse(name)) ?? name;
}

/**
 * The screenshot as Tesseract likes it: no wider than it has to be, and grey.
 * A browser that cannot decode it on a canvas hands the file over untouched,
 * which recognizes fine and only costs time.
 */
async function prepareImage(file: Blob): Promise<Blob | HTMLCanvasElement> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return file;
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (context === null) {
      return file;
    }
    // Grey, not thresholded: Screen Time draws grey bars behind white rows, and
    // anything harder than this eats the thin strokes of a small app name.
    context.filter = 'grayscale(1)';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
