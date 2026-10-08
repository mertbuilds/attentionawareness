import { spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { BROWSER_MARKS } from '../lib/browser.ts';
import { useBrowser } from '../lib/use-browser.ts';

const styles = create({
  // Icon and label as one row, centered against each other, as on the
  // download button.
  cta: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: spacing.s1,
  },
  // The label text, nudged down as the download button's is.
  label: {
    lineHeight: 1,
    transform: 'translateY(1px)',
  },
  // The browser's mark, sized to the label.
  mark: {
    fill: 'currentColor',
    height: '1em',
    width: '1em',
  },
});

/**
 * The extension's label after the mark of the reader's own browser, when it
 * is one whose mark `lib/browser.ts` has. Chrome's mark stands for every
 * other one, Edge among them, and for the server, which cannot tell.
 */
export function ExtensionCta({ label }: { label: string }) {
  const browser = useBrowser();
  return (
    <span {...props(styles.cta)}>
      <svg aria-hidden="true" viewBox="0 0 24 24" {...props(styles.mark)}>
        <path d={BROWSER_MARKS[browser ?? 'chrome']} />
      </svg>
      <span {...props(styles.label)}>{label}</span>
    </span>
  );
}
