// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://news.example/feed" }
import { expect, test, vi } from 'vitest';
import { mockChrome } from './test/chrome.ts';

/**
 * A host reached through a custom rule alone. The content script is registered
 * for it by the service worker, `siteFor` says it is none of the four, and the
 * only thing that may reach the page is the reader's own CSS.
 */
test('a host that is none of ours takes its custom rules and nothing else', async () => {
  mockChrome({
    custom: [{ css: 'h1 { display: none }', domain: 'news.example', enabled: true, id: 'one' }],
  });

  await import('./content.ts');

  await vi.waitFor(() => {
    expect(document.getElementById('aa-rules')?.textContent).toBe('h1 { display: none }');
  });
  expect(document.documentElement.hasAttribute('data-aa-path')).toBe(false);
  expect(document.getElementById('aa-note')).toBeNull();
});
