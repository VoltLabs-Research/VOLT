## Fractal migration note

No React Query migration is needed for `fractal`.

- The module is driven by its own engine and asset loader flow, not React Query.
- Internal imports now point directly to service-layer utilities.
- Legacy helpers in `hooks/cache.ts` and `hooks/queries.ts` remain only as compatibility shims for callers outside this module.
- Further cleanup should happen only after those external callers are updated.
