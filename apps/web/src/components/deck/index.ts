import type { ComponentType } from 'react';
import { BooksGraphic } from './books.tsx';
import { DegreesGraphic } from './degrees.tsx';
import { InstrumentsGraphic } from './instruments.tsx';
import { LanguagesGraphic } from './languages.tsx';
import { MarathonsGraphic } from './marathons.tsx';
import { NovelsGraphic } from './novels.tsx';
import { SkillsGraphic } from './skills.tsx';
import { TripsGraphic } from './trips.tsx';

/**
 * The drawing for each answer to "What else?", by its key in `heroMetrics`.
 * Each plays once from the start when `play` turns on and resets when it
 * turns off.
 */
export const DECK_GRAPHICS: Record<string, ComponentType<{ amount: number; play: boolean }>> = {
  books: BooksGraphic,
  degrees: DegreesGraphic,
  instruments: InstrumentsGraphic,
  languages: LanguagesGraphic,
  marathons: MarathonsGraphic,
  novels: NovelsGraphic,
  skills: SkillsGraphic,
  travel: TripsGraphic,
};
