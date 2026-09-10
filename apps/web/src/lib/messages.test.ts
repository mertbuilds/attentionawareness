import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json' with { type: 'json' };
import tr from '../../messages/tr.json' with { type: 'json' };

// A key that exists in one catalog and not the other is a missing translation
// or a stale one; Paraglide falls back silently, so nothing else would say so.
describe('message catalogs', () => {
  it('translates every English key into Turkish, and nothing more', () => {
    expect(Object.keys(tr).sort()).toEqual(Object.keys(en).sort());
  });

  it('leaves no Turkish message empty', () => {
    const empty = Object.entries(tr)
      .filter(([, value]) => typeof value === 'string' && value.trim() === '')
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });
});
