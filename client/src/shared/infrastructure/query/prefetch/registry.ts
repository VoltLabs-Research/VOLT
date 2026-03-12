import type { PrefetchFactory } from './types';

const registry = new Map<string, PrefetchFactory>();

/**
 * Register prefetch targets for a route path.
 * Call this at module init time (top-level side-effect in queries.ts or registrations file).
 *
 * @param path - The route path to associate with the prefetch factory.
 * @param factory - A function that returns prefetch targets given a context.
 */
export const registerPrefetch = (path: string, factory: PrefetchFactory): void => {
    registry.set(path, factory);
};

/**
 * Look up the prefetch factory for a given path.
 *
 * @param path - The route path to look up.
 * @returns The factory if registered, or undefined.
 */
export const getPrefetchFactory = (path: string): PrefetchFactory | undefined => {
    return registry.get(path);
};
