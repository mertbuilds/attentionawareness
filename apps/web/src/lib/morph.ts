import { duration, easing } from './motion.stylex.ts';

/**
 * One layout gathering into another: the header's open strip into its pill
 * and back. `update` changes the layout at once; the items marked
 * `data-morph` inside `root` then move from where they stood to where they
 * now stand, and `surface`, the ground drawn behind them, grows or shrinks
 * from its old box to its new one.
 *
 * Where the browser has view transitions, the items are carried by one,
 * named with `view-transition-name`. Elsewhere they are moved by hand: each
 * starts at its old box and slides to its new one, and an item that is gone,
 * or drawn as another element, leaves a copy where it stood that fades out.
 * An item that goes fades out over the first half, and one that comes fades
 * in over the second, so the name never stands under the mark sliding past.
 * The surface is not a snapshot in either case: it stays live, so the page
 * blurs through it the whole way. With less motion, the layout only changes.
 */
type Timing = { delay?: number; duration: number; easing: string; fill?: FillMode };

const LENGTH = Number.parseFloat(duration.medium);
const TIMING: Timing = { duration: LENGTH, easing: easing.smoothOut };
const EXIT: Timing = { duration: LENGTH / 2, easing: easing.smoothOut };
/** A copy left behind stays faded out until it is taken away. */
const GHOST: Timing = { ...EXIT, fill: 'forwards' };
const ENTER: Timing = {
  delay: LENGTH / 2,
  duration: LENGTH / 2,
  easing: easing.smoothOut,
  fill: 'backwards',
};
const LESS_MOTION = '(prefers-reduced-motion: reduce)';

type Box = { opacity: string; radius: string; rect: DOMRect };
type Item = { element: HTMLElement; parent: HTMLElement | null; rect: DOMRect };

/** Where `element` is drawn now, motion included, and its running motion stopped. */
function settle(element: HTMLElement): DOMRect {
  const rect = element.getBoundingClientRect();
  for (const animation of element.getAnimations()) {
    animation.cancel();
  }
  return rect;
}

function surfaceBox(surface: HTMLElement): Box {
  const style = getComputedStyle(surface);
  const box = {
    opacity: style.opacity,
    radius: style.borderRadius,
    rect: surface.getBoundingClientRect(),
  };
  settle(surface);
  return box;
}

/** The surface from its old box to the one its container gives it now. */
function growSurface(surface: HTMLElement, from: Box) {
  const to = surface.getBoundingClientRect();
  const style = getComputedStyle(surface);
  surface.animate(
    [
      {
        borderRadius: from.radius,
        bottom: `${to.bottom - from.rect.bottom}px`,
        left: `${from.rect.left - to.left}px`,
        opacity: from.opacity,
        right: `${to.right - from.rect.right}px`,
        top: `${from.rect.top - to.top}px`,
      },
      {
        borderRadius: style.borderRadius,
        bottom: '0px',
        left: '0px',
        opacity: style.opacity,
        right: '0px',
        top: '0px',
      },
    ],
    TIMING,
  );
}

function marked(root: HTMLElement): Map<string, HTMLElement> {
  const items = new Map<string, HTMLElement>();
  for (const element of root.querySelectorAll<HTMLElement>('[data-morph]')) {
    const name = element.dataset.morph;
    if (name !== undefined && element.getBoundingClientRect().width > 0) {
      items.set(name, element);
    }
  }
  return items;
}

/** A copy of `item` where it stood, fading out, then gone. */
function fadeOut(item: Item) {
  // A deep copy of an element is an element of the same kind.
  const ghost = item.element.cloneNode(true) as HTMLElement;
  ghost.removeAttribute('data-morph');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  Object.assign(ghost.style, {
    boxSizing: 'border-box',
    height: `${item.rect.height}px`,
    left: `${item.rect.left}px`,
    margin: '0',
    pointerEvents: 'none',
    position: 'fixed',
    top: `${item.rect.top}px`,
    width: `${item.rect.width}px`,
  });
  // In its old parent where that is still there, so it keeps the type it
  // inherited.
  (item.parent?.isConnected ? item.parent : document.body).append(ghost);
  const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], GHOST);
  void fade.finished.finally(() => ghost.remove()).catch(() => {});
}

/** The marked items from their old boxes to their new ones, by hand. */
function slide(root: HTMLElement, before: Map<string, Item>) {
  for (const [name, element] of marked(root)) {
    const old = before.get(name);
    before.delete(name);
    if (old === undefined) {
      element.animate([{ opacity: 0 }, { opacity: 1 }], ENTER);
      continue;
    }
    const rect = element.getBoundingClientRect();
    const start = {
      transform: `translate(${old.rect.left - rect.left}px, ${old.rect.top - rect.top}px) scale(${old.rect.width / rect.width}, ${old.rect.height / rect.height})`,
      transformOrigin: '0 0',
    };
    const end = { transform: 'none', transformOrigin: '0 0' };
    if (old.element === element) {
      element.animate([start, end], TIMING);
    } else {
      element.animate(
        [
          { ...start, opacity: 0 },
          { ...end, opacity: 1 },
        ],
        TIMING,
      );
      fadeOut(old);
    }
  }
  for (const old of before.values()) {
    fadeOut(old);
  }
}

/**
 * The view transition's own motion, set to the page's timing: a picture with
 * no partner on the other side goes or comes in half the time.
 */
function retime() {
  const pictures = document.getAnimations().flatMap((animation) => {
    // Only a keyframe effect names a pseudo-element.
    const effect = animation.effect as KeyframeEffect | null;
    const match = /^::view-transition-(group|old|new)\((.+)\)$/.exec(effect?.pseudoElement ?? '');
    return effect === null || match === null ? [] : [{ effect, name: match[2], side: match[1] }];
  });
  const sides = new Set(pictures.map(({ name, side }) => `${side} ${name}`));
  for (const { effect, name, side } of pictures) {
    if (side === 'old' && !sides.has(`new ${name}`)) {
      effect.updateTiming(EXIT);
    } else if (side === 'new' && !sides.has(`old ${name}`)) {
      effect.updateTiming(ENTER);
    } else {
      effect.updateTiming(TIMING);
    }
  }
}

export function morph({
  root,
  surface,
  update,
}: {
  root: HTMLElement;
  surface: HTMLElement;
  update: () => void;
}) {
  if (window.matchMedia(LESS_MOTION).matches) {
    update();
    return;
  }
  const from = surfaceBox(surface);

  if (typeof document.startViewTransition === 'function') {
    const transition = document.startViewTransition(update);
    // `ready` rejects when a newer transition cuts this one short, and then
    // there is nothing left to time or grow.
    transition.ready.then(retime).catch(() => {});
    transition.updateCallbackDone.then(() => growSurface(surface, from)).catch(() => {});
    return;
  }

  const before = new Map<string, Item>();
  for (const [name, element] of marked(root)) {
    before.set(name, { element, parent: element.parentElement, rect: settle(element) });
  }
  update();
  slide(root, before);
  growSurface(surface, from);
}
