import { accent } from '@attentionawareness/ui/accent.stylex';
import { colors, font, radius, spacing } from '@attentionawareness/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import Prism from 'prismjs';
import { type CSSProperties, type ReactElement, useEffect, useId, useRef, useState } from 'react';
import EditorImport from 'react-simple-code-editor';
import { normalizeDomain, originPatterns } from '../lib/domain.ts';
import { siteFor } from '../lib/sites.ts';
import { getSettings, newRuleId, setSettings, type CustomRule } from '../lib/storage.ts';
import { sentences, strings } from '../lib/strings.ts';
import { BrandMark } from './brand-mark.tsx';
import { Switch } from './switch.tsx';
// The CSS grammar only: registers `Prism.languages.css`, nothing more of Prism's
// languages ships. The token colours live in `../css-editor.css`.
import 'prismjs/components/prism-css';

/** The subset of the editor's props this page passes. */
type EditorProps = {
  highlight: (value: string) => string;
  insertSpaces?: boolean;
  onValueChange: (value: string) => void;
  padding?: number;
  preClassName?: string;
  style?: CSSProperties;
  tabSize?: number;
  textareaId?: string;
  value: string;
};

/**
 * react-simple-code-editor ships CommonJS that the bundler resolves to a wrapper
 * object `{ default: Editor }`, not the component itself, so rendering the bare
 * import blanks the page. Unwrap the nested `default` at runtime, and re-type it
 * to the props this page uses.
 */
const editorModule = EditorImport as unknown as {
  default?: (props: EditorProps) => ReactElement;
};
const Editor = (editorModule.default ?? EditorImport) as unknown as (
  props: EditorProps,
) => ReactElement;

const MONOSPACE = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/** How long the page sits on an edit before writing it. */
const SAVE_DEBOUNCE_MS = 300;
/** How long "Saved" stays up after a write. */
const SAVED_MS = 2000;
/** How long the prompt button's flash stays up: "Copied", or the empty-site hint. */
const COPIED_MS = 2000;
/** How long an armed Remove waits for its second click before standing down. */
const REMOVE_CONFIRM_MS = 3000;
/** Spaces the editor inserts for a Tab. */
const TAB_SIZE = 2;

/**
 * The editor's own type shares its font with both of its layers by inheritance,
 * so it goes on the container the library owns rather than through StyleX. The
 * min-height opens it at roughly six lines; it grows from there.
 */
const EDITOR_STYLE: CSSProperties = {
  fontFamily: MONOSPACE,
  fontSize: 13,
  lineHeight: 1.5,
  minHeight: 132,
};

/** The CSS painted behind the textarea. Falls back to plain text if the grammar
 * somehow did not register, rather than throwing on every keystroke. */
function highlightCss(code: string): string {
  const grammar = Prism.languages['css'];
  if (grammar === undefined) {
    return code.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  }
  return Prism.highlight(code, grammar, 'css');
}

const styles = create({
  brand: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s2,
  },
  brandName: {
    fontSize: 15,
    fontWeight: font.weightMedium,
  },
  // The prompt button and its hint sit together, under the CSS field, without
  // stretching across the row.
  copyRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    display: 'flex',
    gap: spacing.s2,
  },
  // Wraps the code editor: the border and the ground the library's transparent
  // layers sit on, and the focus ring, since the focus lands on the textarea
  // inside.
  editorWrap: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.fg,
    outlineColor: accent.soft,
    outlineOffset: 1,
    outlineStyle: {
      ':focus-within': 'solid',
      default: 'none',
    },
    outlineWidth: 2,
    overflow: 'hidden',
    width: '100%',
  },
  // The rule's identity. It fills the row so the switch sits at its start and
  // Remove at its far end, the two never crowding into one control.
  domain: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxSizing: 'border-box',
    color: colors.fg,
    flexGrow: 1,
    fontFamily: MONOSPACE,
    fontSize: 13,
    minWidth: 0,
    outlineColor: accent.soft,
    outlineOffset: 1,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 2,
    padding: spacing.s2,
  },
  // Sits with the field it is about, in the error tone, not a stray line at the
  // foot of the rule.
  error: {
    color: colors.error,
    fontSize: 12,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  intro: {
    color: colors.muted,
    fontSize: font.sizeSm,
    margin: 0,
  },
  muted: {
    color: colors.muted,
    fontSize: 12,
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
  // A control that does not want the row: the word, muted, underlined only
  // under the pointer that is about to take it. Add, Remove, and the prompt.
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
    outlineColor: accent.soft,
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
  // Armed: the next click is the one that drops the rule, so the word turns to
  // the error red and asks.
  quietArmed: {
    color: colors.error,
  },
  rule: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
  },
  ruleHead: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s3,
  },
  rules: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    listStyleType: 'none',
    margin: 0,
    padding: 0,
  },
  // Named for the screen reader, and for nobody else: the switch's own name is
  // the domain, read from here.
  srOnly: {
    clipPath: 'inset(50%)',
    height: '1px',
    overflow: 'hidden',
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: '1px',
  },
  title: {
    fontSize: font.sizeLg,
    fontWeight: font.weightMedium,
    margin: 0,
  },
  // The add control and the save flash, above the stack the reader adds to.
  topBar: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s3,
  },
});

/**
 * The options page: the reader's own CSS, one block per site, newest on top.
 * Every edit is debounced into `chrome.storage.sync`, and a domain outside the
 * three sites the manifest covers asks for that host the moment it is
 * committed, because a permission can only be asked for inside the gesture that
 * asked for it.
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

  // New rules go to the front, so the newest is on top and the reader never
  // scrolls to the bottom to add one.
  function add(): void {
    apply([{ css: '', domain: '', enabled: true, id: newRuleId() }, ...latest.current]);
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

      <div {...props(styles.topBar)}>
        <button onClick={add} type="button" {...props(styles.quiet)}>
          {strings.add}
        </button>
        {saves > 0 ? <span {...props(styles.muted)}>{strings.saved}</span> : null}
      </div>

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
  const cssId = useId();
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
    <li {...props(styles.rule)}>
      <div {...props(styles.ruleHead)}>
        <span id={switchLabel} {...props(styles.srOnly)}>
          {rule.domain === '' ? strings.enabledLabel : rule.domain}
        </span>
        <Switch checked={rule.enabled} labelledBy={switchLabel} onChange={onToggle} />
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
        <button
          onClick={onRemove}
          type="button"
          {...props(styles.quiet, armed && styles.quietArmed)}
        >
          {armed ? strings.removeConfirm : strings.remove}
        </button>
      </div>

      {error === undefined ? null : (
        <p id={errorId} {...props(styles.error)}>
          {error}
        </p>
      )}

      <label htmlFor={cssId} {...props(styles.muted)}>
        {strings.cssFieldLabel}
      </label>
      <div {...props(styles.editorWrap)}>
        <Editor
          highlight={highlightCss}
          insertSpaces
          onValueChange={onCssChange}
          padding={8}
          preClassName="language-css"
          style={EDITOR_STYLE}
          tabSize={TAB_SIZE}
          textareaId={cssId}
          value={rule.css}
        />
      </div>

      <div {...props(styles.copyRow)}>
        <button onClick={copy} type="button" {...props(styles.quiet)}>
          {flash === 'copied' ? strings.copyPromptDone : strings.copyPrompt}
        </button>
        {flash === 'hint' ? <span {...props(styles.muted)}>{strings.copyHint}</span> : null}
      </div>
    </li>
  );
}
