import { useEffect, useState } from 'react';
import type { ComponentType, RefObject } from 'react';
import { WIDE_QUERY } from '../lib/wide.ts';
import { m } from '../paraglide/messages.js';
import { MenuLines, menuButton } from './site-menu-button.tsx';

/** One of the header's links, as the menu lists it. */
export type MenuLink = {
  /** Whether the heart stands before it. */
  heart?: boolean;
  href: string;
  label: string;
};

export type MenuProps = {
  /** The header's row, which the panel hangs under. */
  anchor: RefObject<HTMLElement | null>;
  /** The header's own links, in the header's order. */
  links: ReadonlyArray<MenuLink>;
  /** The name the header's morph carries the button by. */
  morph: string;
};

type Panel = ComponentType<MenuProps & { startOpen: boolean }>;

/** How long the menu's code may wait for the browser to be idle, in milliseconds. */
const IDLE = 2000;

/**
 * The menu's own code, fetched once and kept. A fetch that fails is not kept,
 * so the next press asks again.
 */
let fetched: Promise<Panel> | undefined;

function fetchPanel(): Promise<Panel> {
  fetched ??= import('./site-menu-panel.tsx').then(
    (menu) => menu.SiteMenuPanel,
    (error: unknown) => {
      fetched = undefined;
      throw error;
    },
  );
  return fetched;
}

/**
 * The header's menu on a phone. Only a narrow window has it, so its code (the
 * panel, and the popover it is built on) is not part of what every page
 * loads: a wide window never fetches it. A narrow one fetches it once the
 * page is up, in the browser's idle time, so it is in before a thumb gets to
 * the button.
 *
 * Until it is in, the button of two lines stands in the header by itself,
 * looking exactly as the menu's own will, so nothing moves when the menu
 * takes its place. Pressed before then, it crosses its lines at once, fetches
 * the menu if it is not on its way, and the menu opens as it lands. A fetch
 * that fails is tried once more, and if that fails too the page is loaded
 * again, so the button is never left doing nothing.
 */
export function SiteMenu(menu: MenuProps) {
  const [Panel, setPanel] = useState<Panel | null>(null);
  // Whether the button was pressed before the menu was in.
  const [wanted, setWanted] = useState(false);

  useEffect(() => {
    let live = true;
    const wide = window.matchMedia(WIDE_QUERY);
    let waiting: number | undefined;
    const fetch = async () => {
      try {
        const panel = await fetchPanel();
        if (live) {
          setPanel(() => panel);
        }
      } catch {
        // The menu did not come. A press on the button asks for it again.
      }
    };
    const whenNarrow = () => {
      if (wide.matches || waiting !== undefined) {
        return;
      }
      // Safari has had no idle callback for most of its life: there, a short wait.
      const idle: typeof window.requestIdleCallback | undefined = window.requestIdleCallback;
      waiting =
        idle === undefined
          ? window.setTimeout(() => void fetch(), IDLE)
          : window.requestIdleCallback(() => void fetch(), { timeout: IDLE });
    };
    whenNarrow();
    wide.addEventListener('change', whenNarrow);
    return () => {
      live = false;
      wide.removeEventListener('change', whenNarrow);
    };
  }, []);

  if (Panel !== null) {
    return <Panel {...menu} startOpen={wanted} />;
  }

  async function press() {
    setWanted(true);
    try {
      // Asked for twice: a fetch that fails once often goes through the next time.
      const panel = await fetchPanel().catch(fetchPanel);
      setPanel(() => panel);
    } catch {
      // The menu's code is not to be had, most likely because the site was
      // put out anew since this page was loaded and the old file is gone.
      // Loading the page again brings the new one, and a menu that works.
      window.location.reload();
    }
  }

  return (
    <button
      aria-expanded={wanted}
      aria-haspopup="dialog"
      aria-label={wanted ? m.nav_menu_close() : m.nav_menu_open()}
      data-morph={menu.morph}
      onClick={() => void press()}
      type="button"
      {...menuButton(wanted, menu.morph)}
    >
      <MenuLines open={wanted} />
    </button>
  );
}
