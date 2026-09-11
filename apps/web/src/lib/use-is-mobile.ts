import { useEffect, useState } from 'react';

/** A phone, in the same terms the layout uses: everything under the sm step. */
const MOBILE_QUERY = '(max-width: 639px)';

/**
 * Whether the reader is on a phone-sized viewport. The server has no viewport
 * at all, so this answers `false` there and on the first client render — the
 * same answer twice, which is what keeps hydration quiet — and the effect
 * corrects it immediately after, and again whenever the window crosses over.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }
    const query = window.matchMedia(MOBILE_QUERY);
    function update() {
      setIsMobile(query.matches);
    }
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return isMobile;
}
