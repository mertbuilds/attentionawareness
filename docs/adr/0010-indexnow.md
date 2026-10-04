# ADR-0010: New pages are sent to IndexNow

Date: 2026-10-05. Status: accepted.

## Why

- The site got a blog and a new home page on 2026-10-04. Search engines find a new page slowly on a new domain.
- IndexNow is one request that tells the engines which addresses changed. It is free and needs no account.

## Decision

- `pnpm indexnow` (`scripts/indexnow.ts`) posts every address in `apps/web/public/sitemap.xml` to `https://api.indexnow.org/indexnow`. It is run by hand after a deploy that changes content. No workflow runs it.
- The key is the name of `apps/web/public/<32 hex>.txt`, a static file that holds the key. The engines read it from the site's root to check that the sender owns the host. The key is public on purpose: it is no secret, and it only lets someone tell the engines about this site's own addresses.
- The script first checks that the live site serves the key file, and stops if it does not. `--dry-run` prints the request and sends nothing.
- IndexNow reaches Bing, Yandex, Seznam, Naver and the other engines that share it. It does not reach Google. Google reads the sitemap submitted in Search Console (`sc-domain:attentionawareness.com`).
- An accepted request (HTTP 200 or 202) says the addresses were received. It does not say they were crawled or listed.
