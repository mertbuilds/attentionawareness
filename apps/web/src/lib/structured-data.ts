import type { AnswerBlock } from '../components/faq-answer.tsx';
import { splitEmphasis } from './emphasis.ts';

/**
 * The JSON-LD the pages put in their head, for search engines and the
 * assistants that read them. Every builder takes the words a page already
 * shows, so the data never says more than the page does. Nothing here reads a
 * message itself: the routes hand the words in.
 */

export const SITE_URL = 'https://attentionawareness.com';
/** The square mark, the logo a search result shows beside the name. */
const LOGO_URL = `${SITE_URL}/icon-512.png`;
const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const CONTEXT = 'https://schema.org';
/** Where a text block's link stands in its message, as `ANSWER_LINK` in `faq-answer.tsx`. */
const LINK_SLOT = '\u0000';

type JsonLd = Record<string, unknown>;

/**
 * One JSON-LD block as an entry of a route's `meta` list, which the router
 * writes as a script. Its types know only real meta tags, and refuse a list
 * that holds nothing else, so the entry also says it has no `content`.
 */
export function schemaMeta(schema: JsonLd): { content?: never; 'script:ld+json': JsonLd } {
  return { 'script:ld+json': schema };
}

/** A message as plain words: the marks around its stressed words dropped. */
function plainText(message: string): string {
  return splitEmphasis(message)
    .map((run) => run.text)
    .join('');
}

function blockText(block: AnswerBlock): string {
  if (block.kind === 'text') {
    return plainText(block.text.replace(LINK_SLOT, block.link?.label ?? ''));
  }
  if (block.kind === 'path') {
    return `${plainText(block.label)} ${block.steps.join(' > ')}`;
  }
  // Ticked things are single words on one line; dotted ones are sentences.
  const items = block.items.map(plainText).join(block.mark === 'check' ? ', ' : ' ');
  return block.label === undefined ? items : `${plainText(block.label)} ${items}`;
}

/** An answer of the FAQ as one run of plain words, block after block. */
export function answerText(blocks: ReadonlyArray<AnswerBlock>): string {
  return blocks.map(blockText).join(' ');
}

/** Who makes the site, and the site itself. */
function site(name: string, description: string): Array<JsonLd> {
  return [
    {
      '@id': ORGANIZATION_ID,
      '@type': 'Organization',
      logo: { '@type': 'ImageObject', url: LOGO_URL },
      name,
      sameAs: ['https://github.com/mertbuilds/attentionawareness'],
      url: SITE_URL,
    },
    {
      '@id': WEBSITE_ID,
      '@type': 'WebSite',
      description,
      inLanguage: 'en',
      name,
      publisher: { '@id': ORGANIZATION_ID },
      url: SITE_URL,
    },
  ];
}

/**
 * The home page: the site, the Mac app and the questions it answers. The app
 * has no version here: the release changes without a build of the site, and a
 * version written at build would go stale.
 */
export function homeSchema({
  description,
  name,
  questions,
}: {
  description: string;
  name: string;
  questions: ReadonlyArray<{ answer: ReadonlyArray<AnswerBlock>; question: string }>;
}): JsonLd {
  return {
    '@context': CONTEXT,
    '@graph': [
      ...site(name, description),
      {
        '@id': `${SITE_URL}/#app`,
        '@type': 'SoftwareApplication',
        applicationCategory: 'UtilitiesApplication',
        description,
        downloadUrl: `${SITE_URL}/`,
        image: `${SITE_URL}/og/home.png`,
        isAccessibleForFree: true,
        license: 'https://www.gnu.org/licenses/agpl-3.0.html',
        name,
        offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD' },
        operatingSystem: 'macOS',
        publisher: { '@id': ORGANIZATION_ID },
        url: `${SITE_URL}/`,
      },
      {
        '@id': `${SITE_URL}/#faq`,
        '@type': 'FAQPage',
        mainEntity: questions.map((entry) => ({
          '@type': 'Question',
          acceptedAnswer: { '@type': 'Answer', text: answerText(entry.answer) },
          name: entry.question,
        })),
      },
    ],
  };
}

/** A page of steps, each step under its own title as the page numbers them. */
export function howToSchema({
  description,
  name,
  path,
  steps,
  supplies,
  tools,
}: {
  description: string;
  name: string;
  path: string;
  steps: ReadonlyArray<{ name: string; text: string }>;
  supplies: ReadonlyArray<string>;
  tools: ReadonlyArray<string>;
}): JsonLd {
  const url = `${SITE_URL}${path}`;
  return {
    '@context': CONTEXT,
    '@id': `${url}#howto`,
    '@type': 'HowTo',
    description,
    inLanguage: 'en',
    name,
    step: steps.map((step, index) => ({
      '@type': 'HowToStep',
      name: step.name,
      position: index + 1,
      text: step.text,
    })),
    supply: supplies.map((supply) => ({ '@type': 'HowToSupply', name: supply })),
    tool: tools.map((tool) => ({ '@type': 'HowToTool', name: tool })),
    url,
  };
}

/** The way down to a page from the home page, one crumb a level. */
export function breadcrumbSchema(crumbs: ReadonlyArray<{ name: string; path: string }>): JsonLd {
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      item: `${SITE_URL}${crumb.path}`,
      name: crumb.name,
      position: index + 1,
    })),
  };
}
