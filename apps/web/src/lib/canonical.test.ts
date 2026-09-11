import { describe, expect, it } from 'vitest';
import { canonicalRedirect } from './canonical.ts';

describe('canonicalRedirect', () => {
  it('leaves the canonical host alone', () => {
    expect(canonicalRedirect(new URL('https://attentionawareness.com/supervise'))).toBeNull();
  });

  it('sends the www host to the apex', () => {
    const response = canonicalRedirect(new URL('https://www.attentionawareness.com/supervise'));
    expect(response?.status).toBe(301);
    expect(response?.headers.get('location')).toBe('https://attentionawareness.com/supervise');
  });

  it('sends the old domain to the apex, path and query kept', () => {
    const response = canonicalRedirect(new URL('https://keepyourattention.com/?s=abc'));
    expect(response?.status).toBe(301);
    expect(response?.headers.get('location')).toBe('https://attentionawareness.com/?s=abc');
  });

  it('sends subdomains of the old domain too', () => {
    const response = canonicalRedirect(new URL('https://www.keepyourattention.com/supervise'));
    expect(response?.headers.get('location')).toBe('https://attentionawareness.com/supervise');
  });

  it('does not redirect a host that merely ends in the same letters', () => {
    expect(canonicalRedirect(new URL('https://notkeepyourattention.com/'))).toBeNull();
  });
});
