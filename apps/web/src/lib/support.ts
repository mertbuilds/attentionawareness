/** The checkout where a reader pays what they want to support the work. */
const CHECKOUT = 'https://buy.polar.sh/polar_cl_ftX1jafCvlNQXeQZRhjMjBLd2ChzzBp1LTIY63l0MBh';

/**
 * The way to the checkout from one place on the site. Every link off this site
 * carries utm tags, so the visit is traced to where it started: `campaign`
 * names that place.
 */
export function supportUrl(campaign: string): string {
  return `${CHECKOUT}?utm_source=attentionawareness.com&utm_medium=referral&utm_campaign=${campaign}`;
}
