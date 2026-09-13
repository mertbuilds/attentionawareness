import { Input } from '@attentionawareness/ui';
import { colors, font, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useState } from 'react';
import type { BlockedApp } from '../lib/profile/index.ts';
import { encodeFriendShare, FRIEND_NAME_MAX } from '../lib/share.ts';
import { m } from '../paraglide/messages.js';
import { ShareLinks } from './share-links.tsx';

const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/** A first name is a short field. Given the whole row it reads as a form. */
const NAME_WIDTH = 260;

const styles = create({
  block: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  body: {
    color: colors.muted,
    lineHeight: 1.5,
    margin: 0,
    textWrap: 'pretty',
  },
  name: {
    fontFamily: MONOSPACE,
    maxWidth: NAME_WIDTH,
  },
  title: {
    fontSize: font.sizeMd,
    fontWeight: font.weightMedium,
    lineHeight: 1.3,
    margin: 0,
  },
});

/**
 * The second thing to send after a download: not the number, but the page that
 * explains the phone to the people who have to live with it. The name is the
 * whole of the personalization and it is optional, so nothing is stored: a
 * reader who leaves it empty shares a link that opens on "someone".
 */
export function FriendShare({ apps, hours }: { apps: ReadonlyArray<BlockedApp>; hours: number }) {
  const [name, setName] = useState('');
  const url = encodeFriendShare({ bundleIds: apps.map((app) => app.bundleId), hours, name });

  return (
    <div {...props(styles.block)}>
      <h3 {...props(styles.title)}>{m.share_friend_title()}</h3>
      <p {...props(styles.body)}>{m.share_friend_body()}</p>
      <Input
        aria-label={m.share_friend_name()}
        maxLength={FRIEND_NAME_MAX}
        onChange={(event) => setName(event.target.value)}
        placeholder={m.share_friend_name()}
        style={styles.name}
        value={name}
      />
      <ShareLinks label={m.share_friend_title()} text={m.share_friend_text({ url })} url={url} />
    </div>
  );
}
