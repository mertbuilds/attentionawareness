import { Button } from '@attentionawareness/ui';
import { spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useEffect, useState } from 'react';
import { shareTargets } from '../lib/share.ts';
import { m } from '../paraglide/messages.js';

/** How long the Copy button holds its "Copied" label before standing down. */
const COPY_FEEDBACK_MS = 2000;

const styles = create({
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
});

/**
 * The four places one link can go. A dialog holds more than one of these rows,
 * so the row carries the name of the thing it is sharing: without it the
 * second set of buttons is four unlabelled copies of the first.
 */
export function ShareLinks({ label, text, url }: { label: string; text: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const targets = shareTargets(text, url);

  // "Copied" is the whole receipt for a copy, so it goes back on its own.
  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  // No clipboard at all (insecure origin) and a denied one both land here: the
  // three intent links next to the button still carry the same url out.
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div aria-label={label} role="group" {...props(styles.actions)}>
      <Button render={<a href={targets.x} rel="noreferrer" target="_blank" />} variant="outline">
        {m.share_x()}
      </Button>
      <Button
        render={<a href={targets.whatsapp} rel="noreferrer" target="_blank" />}
        variant="outline"
      >
        {m.share_whatsapp()}
      </Button>
      <Button
        render={<a href={targets.linkedin} rel="noreferrer" target="_blank" />}
        variant="outline"
      >
        {m.share_linkedin()}
      </Button>
      <Button onClick={() => void copyLink()} variant="outline">
        {copied ? m.share_copied() : m.share_copy()}
      </Button>
    </div>
  );
}
