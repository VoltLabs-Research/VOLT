import { guestRoutes, protectedRoutes, publicRoutes } from '@/app/routes/definitions';
import { DashboardNavigationSection } from '@/app/routes/types';
import { registerRouteLoader } from '@/shared/utils/route-prefetch';
import { matchPath } from 'react-router-dom';
import type { RouteConfig, RouteNavigationConfig } from '@/app/routes/types';

interface RouteManifestEntry {
    order: number;
    path: string;
    depth: number;
    route: RouteConfig;
};

export interface DashboardNavigationItem {
    label: string;
    path: string;
    icon: RouteNavigationConfig['icon'];
    requiredPermissions?: string[];
    permissionMode?: RouteConfig['permissionMode'];
    disabledReason?: string;
    multiTenantOnly?: boolean;
};

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

const createRouteManifestEntries = (
    routes: RouteConfig[],
    parentPath?: string,
    startingOrder: number = 0
): RouteManifestEntry[] => {
    let order = startingOrder;
    const entries: RouteManifestEntry[] = [];

    routes.forEach((route) => {
        const path = resolveRoutePath(route, parentPath);
        const depth = path.split('/').filter(Boolean).length;

        entries.push({
            order,
            path,
            depth,
            route
        });
        order += 1;

        if (!route.children?.length) {
            return;
        }

        const childEntries = createRouteManifestEntries(route.children, path, order);

        entries.push(...childEntries);
        order += childEntries.length;
    });

    return entries;
};

const resolveDashboardNavigationPath = (path: string): string => {
    return path.replace(/\/:[^/]+\??$/u, '');
};

const routeManifestEntries: RouteManifestEntry[] = createRouteManifestEntries([
    ...publicRoutes,
    ...protectedRoutes,
    ...guestRoutes
]);

const routeTitleEntries: RouteManifestEntry[] = routeManifestEntries.filter((entry) => entry.route.title);

const dashboardNavigationItemsBySection: Record<DashboardNavigationSection, DashboardNavigationItem[]> = {
    [DashboardNavigationSection.Main]: [],
    [DashboardNavigationSection.Secondary]: [],
    [DashboardNavigationSection.Settings]: []
};

routeManifestEntries.forEach((entry) => {
    if (!entry.route.loader) {
        return;
    }

    registerRouteLoader(entry.path, entry.route.loader);
    registerRouteLoader(resolveDashboardNavigationPath(entry.path), entry.route.loader);
});

routeManifestEntries.forEach((entry) => {
    if (!entry.route.navigation) {
        return;
    }

    dashboardNavigationItemsBySection[entry.route.navigation.section].push({
        label: entry.route.navigation.label,
        path: resolveDashboardNavigationPath(entry.path),
        icon: entry.route.navigation.icon,
        requiredPermissions: entry.route.requiredPermissions,
        permissionMode: entry.route.permissionMode,
        disabledReason: entry.route.navigation.disabledReason,
        multiTenantOnly: entry.route.navigation.multiTenantOnly
    });
});

export const getDashboardNavigationItems = (section: DashboardNavigationSection): DashboardNavigationItem[] => {
    return dashboardNavigationItemsBySection[section];
};

export const resolveConfiguredRouteTitle = (pathname: string): string | null => {
    let resolvedEntry: RouteManifestEntry | null = null;

    for (const entry of routeTitleEntries) {
        if (!matchPath({
            path: entry.path,
            end: true
        }, pathname)) {
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

    return resolvedEntry?.route.title ?? null;
};
