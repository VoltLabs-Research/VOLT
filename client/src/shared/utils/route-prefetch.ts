

type RouteLoad = () => Promise<unknown>;

const loaders = new Map<string, RouteLoad>();
const requested = new Set<string>();

export const registerRouteLoader = (path: string, load: RouteLoad): void => {
    loaders.set(path, load);
};

export const prefetchRoute = (path: string): void => {
    if (requested.has(path)) {
        return;
    }

    const load = loaders.get(path);
    if (!load) {
        return;
    }

    requested.add(path);
    void load().catch(() => requested.delete(path));
};
