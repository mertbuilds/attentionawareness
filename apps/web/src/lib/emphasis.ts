/** One run of a sentence: its words, and whether they are stressed. */
export interface Run {
  strong: boolean;
  text: string;
}

/** The mark around stressed words in a message: `**like this**`. */
const MARK = '**';

/**
 * A message cut into runs, the words between each pair of marks stressed.
 * Nothing else in it is read as markup, so a message can never put an
 * element or an attribute on the page. A mark left open stresses nothing:
 * its words read as they are, the mark dropped.
 */
export function splitEmphasis(message: string): Array<Run> {
  const parts = message.split(MARK);
  const closed = parts.length % 2 === 1;
  const runs: Array<Run> = [];
  parts.forEach((text, index) => {
    if (text === '') {
      return;
    }
    const strong = index % 2 === 1 && (closed || index < parts.length - 1);
    runs.push({ strong, text });
  });
  return runs;
}
