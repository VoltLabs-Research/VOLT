import type { QueryKey } from '@tanstack/react-query';

/**
 * A single prefetch target — describes one query to prefetch.
 * Mirrors the shape returned by `createQuery(...).buildOptions(params)`.
 */
export interface PrefetchTarget {
    queryKey: QueryKey;
    queryFn: () => Promise<unknown>;
    staleTime?: number;
};

/**
 * Context available when building prefetch targets.
 * Allows prefetch factories to use team-scoped params.
 */
export interface PrefetchContext {
    teamId: string | null;
};

/**
 * A factory that produces zero or more prefetch targets for a route.
 * Returns an empty array if prefetching doesn't make sense (e.g., no team selected).
 */
export type PrefetchFactory = (ctx: PrefetchContext) => PrefetchTarget[];
