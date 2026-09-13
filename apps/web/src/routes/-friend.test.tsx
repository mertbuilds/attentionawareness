import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { m } from '../paraglide/messages.js';

// The page needs the route factory and the link it was opened with; unit tests
// render the component itself and hand it the search string a router would.
const search = vi.hoisted(() => ({ current: '' }));
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: React.ComponentType }) => options,
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { searchStr: string } }) => string;
  }) => select({ location: { searchStr: search.current } }),
}));

const { Route } = await import('./friend.tsx');

function renderPage(query = '') {
  search.current = query;
  const Page = (Route as unknown as { component: React.ComponentType }).component;
  render(<Page />);
}

describe('FriendPage', () => {
  it('titles itself for the person who was sent the link', () => {
    const { meta } = (
      Route as unknown as { head: () => { meta: Array<{ title: string }> } }
    ).head();

    expect(meta[0]?.title).toContain(m.friend_head_title());
  });

  it('names the sender a link carries', () => {
    renderPage('?h=5&a=ig,tt&n=Mert');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      m.friend_title_named({ name: 'Mert' }),
    );
    expect(screen.getByText(m.friend_lead())).toBeInTheDocument();
  });

  it('stands in for a sender who gave no name', () => {
    renderPage('?h=5&a=ig,tt');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(m.friend_title());
  });

  it('takes a name no further than a first name', () => {
    renderPage(`?h=5&n=${encodeURIComponent('Mert and everyone he has ever met')}`);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      m.friend_title_named({ name: 'Mert and everyone he has' }),
    );
  });

  it('names the apps the link lists', () => {
    renderPage('?h=5&a=ig,tt');

    expect(screen.getByText(m.friend_what_1({ apps: 'Instagram, TikTok' }))).toBeInTheDocument();
  });

  it('names three of a longer list and counts the rest', () => {
    renderPage('?h=5&a=ig,th,tt,sc,yt');

    expect(
      screen.getByText(m.friend_what_1_more({ apps: 'Instagram, Threads, TikTok', count: 2 })),
    ).toBeInTheDocument();
  });

  it('names the four the recommended profile is known by when a link lists none', () => {
    renderPage('?h=5');

    expect(
      screen.getByText(m.friend_what_1({ apps: 'Instagram, TikTok, YouTube, X' })),
    ).toBeInTheDocument();
  });

  it('prices the day the link carries, rounded onto a whole hour', () => {
    renderPage('?m=330&a=ig');

    expect(screen.getByText(m.friend_why_1({ hours: 6, years: '7.5' }))).toBeInTheDocument();
  });

  it('prices the average day where the link carries none, and says whose it is', () => {
    renderPage('?a=ig');

    expect(
      screen.getByText(m.friend_why_1_average({ hours: 4, minutes: 5, years: '5.1' })),
    ).toBeInTheDocument();
    expect(screen.queryByText(m.friend_why_1({ hours: 4, years: '5.1' }))).not.toBeInTheDocument();
  });

  it('answers the four questions the reader actually has', () => {
    renderPage('?h=5&a=ig,tt&n=Mert');

    expect(screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent)).toEqual([
      m.friend_what_title(),
      m.friend_reach_title(),
      m.friend_why_title(),
      m.friend_try_title(),
    ]);
    expect(screen.getByText(m.friend_reach_1())).toBeInTheDocument();
    expect(screen.getByText(m.friend_reach_2())).toBeInTheDocument();
  });

  it('offers a curious reader the generator, and nothing of the sender', () => {
    renderPage('?h=5&a=ig,tt&n=Mert');

    expect(screen.getByRole('link', { name: m.friend_try_cta() })).toHaveAttribute('href', '/');
  });
});
