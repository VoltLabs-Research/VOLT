import type { Endpoint, HttpMethod } from '@volt/contracts/shared/routing';

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
        list.push({
            method: endpoint.method,
            path: endpoint.path,
            handlerName
        });
        routes.set(target.constructor, list);
    };

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
