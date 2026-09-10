import { describe, expect, it } from 'vitest';
import { isThemeChoice, themeAttribute, themeChoices } from './theme.ts';

describe('themeAttribute', () => {
  it('forces the attribute the user picked', () => {
    expect(themeAttribute('dark')).toBe('dark');
    expect(themeAttribute('light')).toBe('light');
  });

  it('leaves the attribute off when the system decides', () => {
    expect(themeAttribute('system')).toBe(null);
    expect(themeAttribute(null)).toBe(null);
    expect(themeAttribute('purple')).toBe(null);
  });

  it('falls back to dark when the system states no preference', () => {
    expect(themeAttribute('system', false)).toBe('dark');
    expect(themeAttribute(null, false)).toBe('dark');
    // A forced choice still wins over the fallback.
    expect(themeAttribute('light', false)).toBe('light');
  });
});

describe('isThemeChoice', () => {
  it('accepts the three states and nothing else', () => {
    for (const choice of themeChoices) {
      expect(isThemeChoice(choice)).toBe(true);
    }
    expect(isThemeChoice('purple')).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });
});
