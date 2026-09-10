---
name: orpc
description: oRPC documentation index — where to find current docs for procedures, routers, middleware, error handling, contracts, clients, OpenAPI/Scalar, Fastify + TanStack Start adapters, and testing. Use when writing or reviewing any oRPC code in this repo (packages/api, apps/api, apps/web client).
---

# oRPC Docs Skill

oRPC = end-to-end typesafe APIs with OpenAPI included. This repo uses it in `packages/api` (router + procedures), `apps/api` (RPCHandler at `/rpc`, OpenAPIHandler at `/api`, Scalar at `/docs`), and `apps/web` (`RouterClient<AppRouter>` over RPCLink).

## Source of truth

**Always fetch current docs instead of answering from memory.** The full doc index lives at:

- https://orpc.dev/llms.txt — machine-readable index of every doc page with descriptions

Fetch that first, then fetch the specific page(s) you need. Doc pages are plain-readable at their URLs.

> **VERSION WARNING:** This repo pins `@orpc/*` **v1.15.x**. orpc.dev documents the latest major (v2 exists — see https://orpc.dev/docs/migrations/from-v1). Before applying a docs pattern, confirm it matches the installed major (`pnpm why @orpc/server`). If docs and installed API disagree, the installed version wins; check the v1→v2 migration page to translate.

## Pages most relevant to this repo

Core:
- https://orpc.dev/docs/procedure — builder: input/output validation, middleware, metadata, typesafe errors
- https://orpc.dev/docs/router — nesting, shared middleware, lazy routes, type inference
- https://orpc.dev/docs/middleware — context injection, guards (our `protectedBase`, `audited()`)
- https://orpc.dev/docs/context — type-safe dependency injection (our db/session/plans context)
- https://orpc.dev/docs/error-handling — ORPCError, typed error definitions (our stable error codes: UNAUTHORIZED, INVALID_INPUT, NOT_FOUND — web maps them to Paraglide messages)

Server (apps/api):
- https://orpc.dev/docs/rpc/handler — RPCHandler (`/rpc`)
- https://orpc.dev/docs/openapi/handler — OpenAPIHandler (`/api`)
- https://orpc.dev/docs/openapi/routing — openapi metadata: methods, paths, prefixes
- https://orpc.dev/docs/openapi/specification — OpenAPIGenerator (our `/openapi.json`)
- https://orpc.dev/docs/openapi/scalar — Scalar reference UI
- https://orpc.dev/docs/adapters/fastify — Fastify adapter, content-type parser gotchas (we register a `*` parser; auth routes need raw body)
- https://orpc.dev/docs/integrations/evlog — structured logging integration
- https://orpc.dev/docs/integrations/zod — Zod via Standard Schema + JSON Schema conversion

Client (apps/web):
- https://orpc.dev/docs/client/client-side — RouterClient over links
- https://orpc.dev/docs/rpc/link — RPCLink (headers, credentials — we send cookies with `credentials: 'include'`)
- https://orpc.dev/docs/client/error-handling — safe clients, typed error narrowing
- https://orpc.dev/docs/adapters/tanstack-start — TanStack Start adapter (if we ever serve oRPC from web itself)
- https://orpc.dev/docs/integrations/tanstack-query — query/mutation options helpers (not installed yet; check before adding)

Testing (apps/api tests):
- https://orpc.dev/docs/client/server-side — `call`, `createRouterClient` (our integration tests call procedures directly)
- https://orpc.dev/docs/recipes/testing-and-mocking — direct testing, mock implementer, MSW

Structure:
- https://orpc.dev/docs/recipes/monorepo-setup — project references for e2e type safety
- https://orpc.dev/docs/contract-first — contract-first workflow (we use router-first today; contracts are an option if the API grows external consumers)

## Repo conventions

- Error codes are stable machine strings, never prose — web localizes via `src/lib/errors.ts`. New procedures define errors the same way.
- Public procedures get `openapi` metadata (method + path) so they appear in Scalar; internal ones stay RPC-only.
- Mutations go through the `audited(entity)` middleware so `audit_log` rows are written.
- `packages/api` must not import from `apps/api` — runtime deps (db, plans, session) enter via context.
