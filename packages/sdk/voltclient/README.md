# @voltstack/voltclient

Standalone HTTP client SDK for the VoltLabs API. Runs on Node.js 18+ and modern
browsers with no required dependencies (native `fetch`); an Axios adapter is an
optional peer dependency for upload-progress reporting.

## Install

```bash
npm install @voltstack/voltclient
# optional, only if you need onUploadProgress:
npm install axios
```

## Quick start

```ts
import { createVoltClient, secretKey } from '@voltstack/voltclient';

const root = createVoltClient('https://api.example.com/api', {
    credential: secretKey('vsk_xxx'),
});

// Scope to an RBAC module by team:
const containers = root.withBasePath('/container', { useRBAC: true, getTeamId: () => teamId });
const list = await containers.getPaginated('/');
```

## Choosing an API layer

The client exposes three layers; pick the lowest one that fits:

1. **Raw** — `request` / `get` / `post` / `patch` / `delete` return the response untouched.
2. **Unwrappers** — `getUnwrapped`, `postUnwrapped`, … strip the server's `{ status, data }`
   envelope; `getPaginated` normalizes paginated responses.
3. **Declarative services** — for many endpoints, describe them once with `createService`
   instead of hand-writing calls:

```ts
import { createService, get, post } from '@voltstack/voltclient';

const users = createService('/users', {
    list: get('/'),
    getById: get<{ id: string }, User>('/:id'),
    create: post<CreateUserInput, User>('/'),
}, createClientFactory);
```

Path params (`:id`) are filled from the argument object; the remaining fields
become the query string on GET/DELETE and the body on POST/PATCH.

## Authentication

A `CredentialProvider` returns a bearer token (sync or async). Presets:

- `staticToken(token)` / `secretKey('vsk_…')` — a fixed token.
- `dynamicToken(() => store.get())` — resolved per request (supports refresh).

## Behaviour notes

- **In-flight GET deduplication** is on by default: concurrent identical GETs share
  one request. Disable per client with `dedupeGetRequests: false` (recommended for
  server-side callers that want 1:1 request mapping).
- **Errors** are thrown as `ApiError` carrying the server's `code` and HTTP `status`.
  Use `err.getFriendlyMessage()` for SDK-known codes and `err.isPermissionDenied()`
  for RBAC handling. The SDK does not duplicate the server's full message catalogue —
  unknown server codes are surfaced verbatim.

## Develop

```bash
npm run build       # bundle to dist/ (ESM + CJS + d.ts)
npm run typecheck   # tsc --noEmit
npm test            # node:test suite over tests/
```
