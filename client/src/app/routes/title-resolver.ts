import { routesConfig } from './config';
import type { RouteConfig, RouteGroup } from './types';
import { matchPath } from 'react-router-dom';

interface RouteTitleEntry {
    order: number;
    path: string;
    title: string;
    depth: number;
};

type RouteCollectionKey = keyof Pick<RouteGroup, 'public' | 'protected' | 'guest'>;

const ROUTE_COLLECTION_KEYS: RouteCollectionKey[] = ['public', 'protected', 'guest'];

const joinRoutePaths = (parentPath: string, childPath: string): string => {
    const normalizedParent = parentPath.endsWith('/') ? parentPath.slice(0, -1) : parentPath;
    const normalizedChild = childPath.startsWith('/') ? childPath : `/${childPath}`;

    return `${normalizedParent}${normalizedChild}`;
};

const resolveRoutePath = (route: RouteConfig, parentPath?: string): string => {
    if (route.index && parentPath) {
        return parentPath;
    }

    if (!parentPath || route.path.startsWith('/')) {
        return route.path;
    }

    return joinRoutePaths(parentPath, route.path);
};

const createRouteTitleEntries = (
    routes: RouteConfig[],
    parentPath?: string,
    startingOrder: number = 0
): RouteTitleEntry[] => {
    let order = startingOrder;
    const entries: RouteTitleEntry[] = [];

    routes.forEach((route) => {
        const routePath = resolveRoutePath(route, parentPath);
        const depth = routePath.split('/').filter(Boolean).length;

        if (route.title) {
            entries.push({
                order,
                path: routePath,
                title: route.title,
                depth
            });
            order += 1;
        }

        if (route.children && route.children.length > 0) {
            const childEntries = createRouteTitleEntries(route.children, routePath, order);
            entries.push(...childEntries);
            order += childEntries.length;
        }
    });

    return entries;
};

const ROUTE_TITLE_ENTRIES = ROUTE_COLLECTION_KEYS.flatMap((collectionKey) => {
    return createRouteTitleEntries(routesConfig[collectionKey]);
});

/** Resolves the most specific configured route title for a pathname. */
export const resolveRouteTitle = (pathname: string): string | null => {
    let resolvedEntry: RouteTitleEntry | null = null;

    for (const entry of ROUTE_TITLE_ENTRIES) {
        if (!matchPath({ path: entry.path, end: true }, pathname)) {
            continue;
        }

        if (!resolvedEntry) {
            resolvedEntry = entry;
            continue;
        }

        if (entry.depth > resolvedEntry.depth || (entry.depth === resolvedEntry.depth && entry.order > resolvedEntry.order)) {
            resolvedEntry = entry;
        }
    }

    if (resolvedEntry === null) {
        return null;
    }

    return resolvedEntry.title;
};
