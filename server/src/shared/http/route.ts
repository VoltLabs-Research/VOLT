import type { Endpoint, HttpMethod } from '@volt/contracts/shared/routing';

/**
 * Pollium-style routing metadata. A controller method is bound to a wire
 * endpoint with `@Route(containerRoutes.create)`; the method + its param
 * decorators are all that's needed — no per-module route file, no
 * createHttpModule. `Controller.buildRouter()` reads this metadata to build the
 * Express router.
 */
export interface RouteDefinition {
    method: HttpMethod;
    path: string;
    handlerName: string | symbol;
    statusCode?: number;
}

const routes = new WeakMap<object, RouteDefinition[]>();
const statusByHandler = new WeakMap<object, Map<string | symbol, number>>();

export const Route = <I, O>(endpoint: Endpoint<I, O>): MethodDecorator =>
    (target, handlerName) => {
        const list = routes.get(target.constructor) ?? [];
        list.push({ method: endpoint.method, path: endpoint.path, handlerName });
        routes.set(target.constructor, list);
    };

/** Override the success status code for a handler (default 200, or 204 for empty). */
export const Status = (code: number): MethodDecorator =>
    (target, handlerName) => {
        const map = statusByHandler.get(target.constructor) ?? new Map();
        map.set(handlerName, code);
        statusByHandler.set(target.constructor, map);
    };

export const getRoutes = (ctor: object): RouteDefinition[] =>
    (routes.get(ctor) ?? []).map((route) => ({
        ...route,
        statusCode: statusByHandler.get(ctor)?.get(route.handlerName)
    }));
