import { resolveConfiguredRouteTitle } from '@/app/routes/metadata';

/** Resolves the most specific configured route title for a pathname. */
export const resolveRouteTitle = (pathname: string): string | null => {
    return resolveConfiguredRouteTitle(pathname);
};
