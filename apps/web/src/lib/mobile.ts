/** The agents of a phone or a tablet: Android, an iPhone, an iPad, or any browser that calls itself mobile. */
const MOBILE_AGENT = /Android|iPhone|iPad|iPod|Mobi/;

/**
 * Whether a browser is a phone or a tablet, which cannot run the app. iPadOS
 * asks for pages as a Mac does, so a Mac that takes touch is counted as one
 * too. The agent decides, never the window's width: a narrow window on a Mac
 * still downloads.
 */
export function isMobileAgent(userAgent: string, maxTouchPoints: number): boolean {
  return MOBILE_AGENT.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/**
 * Marks the root of a phone or a tablet before first paint, by the same test,
 * so what the page draws for one is right from the server's page on, before
 * React has told the device apart.
 */
export const MOBILE_SCRIPT =
  `try{var n=navigator;if(${MOBILE_AGENT.toString()}.test(n.userAgent)||(/Macintosh/.test(n.userAgent)&&n.maxTouchPoints>1))` +
  "document.documentElement.setAttribute('data-aa-mobile','')}catch(e){}";
