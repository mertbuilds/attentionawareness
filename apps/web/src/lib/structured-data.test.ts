import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answerText, breadcrumbSchema, homeSchema } from './structured-data.ts';

test('an answer reads as the plain words the page shows', () => {
  assert.equal(
    answerText([
      { kind: 'text', text: '**Yes.** It is free.' },
      {
        kind: 'text',
        link: { href: '/guide', label: 'manual guide' },
        text: 'The \u0000 shows each step.',
      },
      { items: ['Erase it.', 'Use a Mac.'], kind: 'list', mark: 'dot' },
      { items: ['photos', 'messages'], kind: 'list', label: '**What stays:**', mark: 'check' },
      { kind: 'path', label: '**Back up:**', steps: ['Settings', 'iCloud'] },
    ]),
    'Yes. It is free. The manual guide shows each step. Erase it. Use a Mac. ' +
      'What stays: photos, messages Back up: Settings > iCloud',
  );
});

test('the home page names a free Mac app and every question once', () => {
  const schema = homeSchema({
    description: 'A free Mac app.',
    name: 'attention awareness',
    questions: [{ answer: [{ kind: 'text', text: '**Yes.**' }], question: 'Is it free?' }],
  });
  const graph = schema['@graph'] as Array<Record<string, unknown>>;
  assert.deepEqual(
    graph.map((node) => node['@type']),
    ['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage'],
  );
  const app = graph[2];
  assert.equal(app?.['operatingSystem'], 'macOS');
  assert.deepEqual(app?.['offers'], { '@type': 'Offer', price: 0, priceCurrency: 'USD' });
  assert.equal(app?.['softwareVersion'], undefined);
  assert.deepEqual(graph[3]?.['mainEntity'], [
    {
      '@type': 'Question',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes.' },
      name: 'Is it free?',
    },
  ]);
});

test('crumbs are numbered from the home page down', () => {
  const crumbs = breadcrumbSchema([
    { name: 'attention awareness', path: '/' },
    { name: 'Blog', path: '/blog' },
  ]);
  assert.deepEqual(crumbs['itemListElement'], [
    {
      '@type': 'ListItem',
      item: 'https://attentionawareness.com/',
      name: 'attention awareness',
      position: 1,
    },
    { '@type': 'ListItem', item: 'https://attentionawareness.com/blog', name: 'Blog', position: 2 },
  ]);
});
