import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useEffect, useId, useRef, useState } from 'react';
import { normalizeDomain, originPatterns } from '../lib/domain.ts';
import { siteFor } from '../lib/sites.ts';
import { getSettings, newRuleId, setSettings, type CustomRule } from '../lib/storage.ts';
import { sentences, strings } from '../lib/strings.ts';
import { BrandMark } from './brand-mark.tsx';
import { Switch } from './switch.tsx';

const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/** How long the page sits on an edit before writing it. */
const SAVE_DEBOUNCE_MS = 300;
/** How long "Saved" stays up after a write. */
const SAVED_MS = 2000;
/** How long the prompt button's flash stays up: "Copied", or the empty-site hint. */
const COPIED_MS = 2000;
/** How long an armed Remove waits for its second click before standing down. */
const REMOVE_CONFIRM_MS = 3000;
/** What Tab puts in the textarea instead of leaving it. */
const INDENT = '  ';
/** Rows the CSS field opens at. It grows by hand from there. */
const CSS_ROWS = 6;

const styles = create({
  // The one strong way to grow the list: a dashed, full-width button, neutral
  // rather than accent, so the page keeps a single chromatic note (the on
  // switch) instead of two competing for the eye.
  add: {
    alignItems: 'center',
    backgroundColor: {
      ':hover': 'var(--secondary)',
      default: 'transparent',
    },
    borderColor: {
      ':hover': colors.fg,
      default: colors.border,
    },
    borderRadius: radius.base,
    borderStyle: 'dashed',
    borderWidth: '1px',
    color: colors.fg,
    cursor: 'pointer',
    display: 'flex',
    fontFamily: 'inherit',
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    justifyContent: 'center',
    outlineColor: colors.fg,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 2,
    paddingBlock: spacing.s3,
    paddingInline: spacing.s4,
    width: '100%',
  },
  brand: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s2,
  },
  brandName: {
    fontSize: 15,
    fontWeight: font.weightMedium,
  },
  // A field's small, quiet label. The name is secondary; the value is not.
  caption: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: font.weightMedium,
  },
  // The card one rule lives in. `--secondary` is the design system's raised
  // surface (theme.css keeps its light and dark values in step), one step off
  // the page so two rules never blur into one.
  card: {
    backgroundColor: 'var(--secondary)',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    padding: spacing.s4,
  },
  // A real secondary button now, not a caption: outlined, on the page's base
  // surface so it lifts off the card, and always live (see the empty-site hint).
  copyButton: {
    backgroundColor: colors.bg,
    borderColor: {
      ':hover': colors.fg,
      default: colors.border,
    },
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    color: colors.fg,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    fontWeight: font.weightMedium,
    outlineColor: colors.fg,
    outlineOffset: 1,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 2,
    paddingBlock: spacing.s1,
    paddingInline: spacing.s2,
  },
  copyRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    display: 'flex',
    gap: spacing.s2,
  },
  css: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.fg,
    fontFamily: MONOSPACE,
    fontSize: 13,
    lineHeight: 1.5,
    outlineColor: colors.fg,
    outlineOffset: 1,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 2,
    padding: spacing.s2,
    resize: 'vertical',
    width: '100%',
  },
  // The card's identity, and its most prominent value: base surface so it lifts
  // off the card, and a step up in size and weight from the mono elsewhere.
  domain: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.fg,
    fontFamily: MONOSPACE,
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    outlineColor: colors.fg,
    outlineOffset: 1,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 2,
    padding: spacing.s2,
    width: '100%',
  },
  // Sits with the field it is about, in the error tone, not a stray grey line
  // at the foot of the card.
  error: {
    color: colors.error,
    fontSize: 12,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  // The hint the copy button shows on an empty site: a nudge to fill the field,
  // not an error, so it stays muted.
  hint: {
    color: colors.muted,
    fontSize: 12,
  },
  intro: {
    color: colors.muted,
    fontSize: font.sizeSm,
    margin: 0,
  },
  // The top of the card: the site label on the left, the on switch and the
  // muted Remove pushed to the right.
  metaRow: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s3,
  },
  page: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    marginInline: 'auto',
    maxWidth: 640,
    padding: spacing.s8,
  },
  // Remove: a muted secondary that does not want the row. A screaming control
  // for a routine deletion is the wrong hierarchy; the word, grey, is enough.
  quiet: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    outlineColor: colors.fg,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 2,
    padding: 0,
    textDecorationLine: {
      ':hover': 'underline',
      default: 'none',
    },
  },
  // Armed: the second click is the one that drops the rule, so the word stops
  // being quiet about it.
  quietArmed: {
    color: colors.fg,
    textDecorationLine: 'underline',
  },
  rules: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  },
  saved: {
    alignSelf: 'center',
    color: colors.muted,
    fontSize: 12,
  },
  // The card's identity label: small, uppercase, secondary, sat above the
  // prominent value. `marginRight: auto` pushes the switch and Remove right.
  siteLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: font.weightMedium,
    letterSpacing: '0.04em',
    marginRight: 'auto',
    textTransform: 'uppercase',
  },
  // Named for the screen reader, and for nobody else: the switch's own name is
  // the domain, read from here, so the visible on/off word can stay decorative.
  srOnly: {
    clipPath: 'inset(50%)',
    height: '1px',
    overflow: 'hidden',
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: '1px',
  },
  stateLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  title: {
    fontSize: font.sizeLg,
    fontWeight: font.weightMedium,
    margin: 0,
  },
  toggleGroup: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s2,
  },
});

/**
 * The options page: the reader's own CSS, one block per site. Every edit is
 * debounced into `chrome.storage.sync`, and a domain outside the three sites
 * the manifest covers asks for that host the moment it is committed, because
 * a permission can only be asked for inside the gesture that asked for it.
 */
export function Options() {
  const [rules, showRules] = useState<Array<CustomRule>>([]);
  // One line per rule at most: a bad domain and a refused permission are the
  // same slot, because the second cannot happen while the first is true.
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [armed, setArmed] = useState<string | null>(null);
  const [saves, setSaves] = useState(0);

  /**
   * What the next write will send. Handlers read this rather than the render's
   * own copy: a permission answer arrives whenever the reader clicks the
   * browser's prompt, which can be several edits later.
   */
  const latest = useRef<Array<CustomRule>>(rules);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read once. The popup follows storage live because a switch is the whole of
  // what it shows; a half-typed textarea is not something to overwrite from
  // another window.
  useEffect(() => {
    void getSettings().then((settings) => {
      latest.current = settings.custom;
      showRules(settings.custom);
    });
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (saves === 0) {
      return;
    }
    const hide = setTimeout(() => setSaves(0), SAVED_MS);
    return () => clearTimeout(hide);
  }, [saves]);

  // An armed Remove is a trap for the next stray click, so it stands down on
  // its own: Escape, or a few seconds of the reader doing something else.
  useEffect(() => {
    if (armed === null) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setArmed(null);
      }
    }
    const stand = setTimeout(() => setArmed(null), REMOVE_CONFIRM_MS);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(stand);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [armed]);

  function apply(next: Array<CustomRule>): void {
    latest.current = next;
    showRules(next);
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      void setSettings({ custom: latest.current }).then(() => setSaves((count) => count + 1));
    }, SAVE_DEBOUNCE_MS);
  }

  function patch(id: string, changes: Partial<CustomRule>): void {
    apply(latest.current.map((rule) => (rule.id === id ? { ...rule, ...changes } : rule)));
  }

  function setError(id: string, message: string | null): void {
    setErrors((current) => {
      const next = { ...current };
      if (message === null) {
        delete next[id];
      } else {
        next[id] = message;
      }
      return next;
    });
  }

  /**
   * Asks for the host, straight out of the click or blur that got here. The
   * three sites the manifest already covers are skipped; everything else is a
   * prompt the reader can refuse, and a refused rule is left off rather than
   * left on and silently doing nothing.
   */
  function requestAccess(id: string, domain: string): void {
    if (siteFor(domain) !== null) {
      return;
    }
    void chrome.permissions.request({ origins: originPatterns(domain) }).then((granted) => {
      if (granted) {
        setError(id, null);
        return;
      }
      setError(id, sentences.denied(domain));
      patch(id, { enabled: false });
    });
  }

  /** The typed domain, cleaned up and committed. Anything else is an error. */
  function commitDomain(rule: CustomRule, typed: string): void {
    const domain = normalizeDomain(typed);
    if (domain === null) {
      setError(rule.id, strings.badDomain);
      return;
    }
    setError(rule.id, null);
    patch(rule.id, { domain });
    if (rule.enabled) {
      requestAccess(rule.id, domain);
    }
  }

  function toggle(rule: CustomRule, on: boolean): void {
    const domain = normalizeDomain(rule.domain);
    if (!on || domain === null) {
      patch(rule.id, { enabled: on });
      return;
    }
    setError(rule.id, null);
    patch(rule.id, { domain, enabled: true });
    requestAccess(rule.id, domain);
  }

  function remove(id: string): void {
    if (armed !== id) {
      setArmed(id);
      return;
    }
    setArmed(null);
    setError(id, null);
    apply(latest.current.filter((rule) => rule.id !== id));
  }

  return (
    <div {...props(styles.page)}>
      <header {...props(styles.header)}>
        <div {...props(styles.brand)}>
          <BrandMark />
          <span {...props(styles.brandName)}>{strings.brand}</span>
        </div>
        <h1 {...props(styles.title)}>{strings.customCss}</h1>
        <p {...props(styles.intro)}>{strings.customIntro}</p>
      </header>

      <ul {...props(styles.rules)}>
        {rules.map((rule) => (
          <Rule
            armed={armed === rule.id}
            error={errors[rule.id]}
            key={rule.id}
            onCssChange={(css) => patch(rule.id, { css })}
            onDomainChange={(domain) => patch(rule.id, { domain })}
            onDomainCommit={(typed) => commitDomain(rule, typed)}
            onRemove={() => remove(rule.id)}
            onToggle={(on) => toggle(rule, on)}
            rule={rule}
          />
        ))}
      </ul>

      <div {...props(styles.footer)}>
        <button
          onClick={() =>
            apply([...latest.current, { css: '', domain: '', enabled: true, id: newRuleId() }])
          }
          type="button"
          {...props(styles.add)}
        >
          {strings.add}
        </button>
        {saves > 0 ? <span {...props(styles.saved)}>{strings.saved}</span> : null}
      </div>
    </div>
  );
}

/** One rule: the host it is for, whether it applies, and the CSS itself. */
function Rule({
  armed,
  error,
  onCssChange,
  onDomainChange,
  onDomainCommit,
  onRemove,
  onToggle,
  rule,
}: {
  armed: boolean;
  error: string | undefined;
  onCssChange: (css: string) => void;
  onDomainChange: (domain: string) => void;
  onDomainCommit: (typed: string) => void;
  onRemove: () => void;
  onToggle: (on: boolean) => void;
  rule: CustomRule;
}) {
  const switchLabel = useId();
  const errorId = useId();
  // Idle, or one of two flashes on the prompt button: the copy landed, or the
  // site is still empty and the button taught rather than copied.
  const [flash, setFlash] = useState<'copied' | 'hint' | null>(null);

  // A flash is a flash, not a mode: it stands down on its own a couple of
  // seconds later, the way "Saved" does on the page.
  useEffect(() => {
    if (flash === null) {
      return;
    }
    const revert = setTimeout(() => setFlash(null), COPIED_MS);
    return () => clearTimeout(revert);
  }, [flash]);

  // Always live: an empty site does not grey the button out, it points at the
  // field that has to come first.
  function copy(): void {
    if (rule.domain.trim() === '') {
      setFlash('hint');
      return;
    }
    void navigator.clipboard.writeText(sentences.promptTemplate(rule.domain));
    setFlash('copied');
  }

  return (
    <li {...props(styles.card)}>
      <div {...props(styles.metaRow)}>
        <span {...props(styles.siteLabel)}>{strings.siteLabel}</span>
        <div {...props(styles.toggleGroup)}>
          <span aria-hidden="true" {...props(styles.stateLabel)}>
            {rule.enabled ? strings.on : strings.off}
          </span>
          <span id={switchLabel} {...props(styles.srOnly)}>
            {rule.domain === '' ? strings.enabledLabel : rule.domain}
          </span>
          <Switch checked={rule.enabled} labelledBy={switchLabel} onChange={onToggle} />
        </div>
        <button
          onClick={onRemove}
          type="button"
          {...props(styles.quiet, armed && styles.quietArmed)}
        >
          {armed ? strings.removeConfirm : strings.remove}
        </button>
      </div>

      <div {...props(styles.field)}>
        <input
          aria-describedby={error === undefined ? undefined : errorId}
          aria-invalid={error === undefined ? undefined : true}
          aria-label={strings.domainLabel}
          onBlur={(event) => onDomainCommit(event.target.value)}
          onChange={(event) => onDomainChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          placeholder={strings.domainPlaceholder}
          spellCheck={false}
          value={rule.domain}
          {...props(styles.domain)}
        />
        {error === undefined ? null : (
          <p id={errorId} {...props(styles.error)}>
            {error}
          </p>
        )}
      </div>

      <div {...props(styles.field)}>
        <span {...props(styles.caption)}>{strings.cssFieldLabel}</span>
        <textarea
          aria-label={strings.cssLabel}
          onChange={(event) => onCssChange(event.target.value)}
          onKeyDown={(event) => {
            // Tab is indentation in a CSS block, not the way out of one. Shift
            // and Tab still leaves, which is the keyboard's escape hatch.
            if (event.key !== 'Tab' || event.shiftKey) {
              return;
            }
            event.preventDefault();
            const field = event.currentTarget;
            const { selectionEnd, selectionStart, value } = field;
            const next = value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd);
            const caret = selectionStart + INDENT.length;
            field.value = next;
            field.setSelectionRange(caret, caret);
            onCssChange(next);
          }}
          rows={CSS_ROWS}
          spellCheck={false}
          value={rule.css}
          {...props(styles.css)}
        />

        <div {...props(styles.copyRow)}>
          <button onClick={copy} type="button" {...props(styles.copyButton)}>
            {flash === 'copied' ? strings.copyPromptDone : strings.copyPrompt}
          </button>
          {flash === 'hint' ? <span {...props(styles.hint)}>{strings.copyHint}</span> : null}
        </div>
      </div>
    </li>
  );
}
