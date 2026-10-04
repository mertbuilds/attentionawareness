import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { splitEmphasis } from '../lib/emphasis.ts';
import { m } from '../paraglide/messages.js';

/**
 * One block of an answer: a sentence or two, a list, or a way through the
 * iPhone's Settings. Every string is a message, and its stressed words are
 * marked in it as `**words**`.
 */
export type AnswerBlock =
  | { kind: 'text'; text: string }
  | {
      items: ReadonlyArray<string>;
      kind: 'list';
      label?: string | undefined;
      /** `dot` stands the items one under the other; `check` runs them on as a line of ticks. */
      mark: 'check' | 'dot';
    }
  | { kind: 'path'; label: string; steps: ReadonlyArray<string> };

/** The marks that carry meaning to the eye; each is hidden from a screen reader. */
const ARROW = '→';
const CHECK = '✓';
const DOT = '•';

const styles = create({
  // The arrow between two steps of a way through Settings.
  arrow: {
    color: colors.muted,
    paddingInline: spacing.s1,
  },
  // The blocks of an answer, a short step apart, clear of the chevron above.
  body: {
    color: colors.muted,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    lineHeight: 1.5,
    paddingBlockEnd: spacing.s4,
    paddingInlineEnd: spacing.s8,
    textWrap: 'pretty',
  },
  // The tick before a thing that stays, in the orange of the page's ticks.
  check: {
    color: accent.base,
    marginInlineEnd: spacing.s1,
  },
  // Ticked things run on as one line, wrapping where the column ends.
  checks: {
    columnGap: spacing.s4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: null,
    rowGap: spacing.s1,
  },
  // The dot before an item, in the middle of its first line.
  dot: {
    color: colors.muted,
    flexShrink: 0,
  },
  // One item: its dot, then its words, wrapping clear of the dot.
  item: {
    display: 'flex',
    gap: spacing.s2,
  },
  // A list's name, close over it.
  labelled: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  plain: {
    margin: 0,
  },
  // Read out between two steps, where the eye has an arrow.
  spoken: {
    clipPath: 'inset(50%)',
    height: 1,
    overflow: 'hidden',
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: 1,
  },
  // A stressed word: the ink and one step of weight, never a heavy bold.
  strong: {
    color: colors.fg,
    fontWeight: font.weightMedium,
  },
});

/** A message with its marked words stressed, and nothing else read as markup. */
function Emphasis({ text }: { text: string }) {
  return splitEmphasis(text).map((run, index) =>
    run.strong ? (
      // The runs of one message never move, so their place is their name.
      // oxlint-disable-next-line react/no-array-index-key
      <strong key={index} {...props(styles.strong)}>
        {run.text}
      </strong>
    ) : (
      run.text
    ),
  );
}

function Block({ block }: { block: AnswerBlock }) {
  if (block.kind === 'text') {
    return (
      <p {...props(styles.plain)}>
        <Emphasis text={block.text} />
      </p>
    );
  }
  if (block.kind === 'path') {
    return (
      <p {...props(styles.plain)}>
        <Emphasis text={block.label} />{' '}
        {block.steps.map((step, index) => (
          <span key={step}>
            {index > 0 && (
              <>
                <span aria-hidden="true" {...props(styles.arrow)}>
                  {ARROW}
                </span>
                <span {...props(styles.spoken)}>{`, ${m.home_faq_path_then()} `}</span>
              </>
            )}
            {step}
          </span>
        ))}
      </p>
    );
  }
  const check = block.mark === 'check';
  const list = (
    <ul {...props(styles.list, check && styles.checks)}>
      {block.items.map((item) => (
        <li key={item} {...props(!check && styles.item)}>
          <span aria-hidden="true" {...props(check ? styles.check : styles.dot)}>
            {check ? CHECK : DOT}
          </span>
          <span>
            <Emphasis text={item} />
          </span>
        </li>
      ))}
    </ul>
  );
  if (block.label === undefined) {
    return list;
  }
  return (
    <div {...props(styles.labelled)}>
      <p {...props(styles.plain)}>
        <Emphasis text={block.label} />
      </p>
      {list}
    </div>
  );
}

/** What a block is known by among its answer's blocks: its first words. */
function blockKey(block: AnswerBlock): string {
  if (block.kind === 'text') {
    return block.text;
  }
  if (block.kind === 'path') {
    return block.label;
  }
  return block.label ?? block.items.join();
}

/** An answer of the FAQ, block under block. */
export function FaqAnswer({ blocks }: { blocks: ReadonlyArray<AnswerBlock> }) {
  return (
    <div {...props(styles.body)}>
      {blocks.map((block) => (
        <Block block={block} key={blockKey(block)} />
      ))}
    </div>
  );
}
