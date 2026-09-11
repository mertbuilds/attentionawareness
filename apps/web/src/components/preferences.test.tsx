import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { m } from '../paraglide/messages.js';

// Switching the language reloads the document through Paraglide's runtime;
// jsdom has no reload, so only the two locale calls are stubbed — the rest of
// the runtime stays real, because the message functions call into it.
const setLocale = vi.fn();
vi.mock(import('../paraglide/runtime.js'), async (importOriginal) => ({
  ...(await importOriginal()),
  getLocale: () => 'en',
  setLocale: (locale: string) => setLocale(locale),
}));

const { LanguageSwitch, PreferencesRow, ThemeSwitch } = await import('./preferences.tsx');

describe('Preferences', () => {
  beforeEach(() => {
    setLocale.mockClear();
    delete document.documentElement.dataset['theme'];
  });

  it('names the language it is currently showing', () => {
    render(<LanguageSwitch />);
    expect(screen.getByRole('button', { name: m.pref_language_label() })).toHaveTextContent(
      m.pref_language_en(),
    );
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('switches the locale from the listbox', async () => {
    render(<LanguageSwitch />);

    await userEvent.click(screen.getByRole('button', { name: m.pref_language_label() }));
    await userEvent.click(screen.getByRole('option', { name: m.pref_language_tr() }));

    expect(setLocale).toHaveBeenCalledWith('tr');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens on system and forces the theme the user picks', async () => {
    render(<ThemeSwitch />);
    expect(
      screen.getByRole('button', { name: m.pref_theme_system(), pressed: true }),
    ).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: m.pref_theme_dark() }));

    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(screen.getByRole('button', { name: m.pref_theme_dark(), pressed: true })).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: m.pref_theme_light() }));

    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(screen.getByRole('button', { name: m.pref_theme_light(), pressed: true })).toBeVisible();
  });

  it('keeps the choice while another page mounts the control again', async () => {
    const first = render(<ThemeSwitch />);
    await userEvent.click(screen.getByRole('button', { name: m.pref_theme_dark() }));
    first.unmount();

    render(<ThemeSwitch />);

    expect(screen.getByRole('button', { name: m.pref_theme_dark(), pressed: true })).toBeVisible();
  });

  it('shows the theme and the language side by side in one row', () => {
    render(<PreferencesRow />);
    expect(screen.getByRole('group', { name: m.pref_theme_label() })).toBeVisible();
    expect(screen.getByRole('button', { name: m.pref_language_label() })).toBeVisible();
  });
});
