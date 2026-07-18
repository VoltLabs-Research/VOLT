import { Router } from 'express';
import type { RequestHandler, Response } from 'express';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { getRoutes } from '@shared/http/route';
import { getParamResolvers } from '@shared/http/params';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

const classMiddleware = new WeakMap<object, RequestHandler[]>();
const handlerMiddleware = new WeakMap<object, Map<string | symbol, RequestHandler[]>>();

/**
 * Attach Express middleware. On the class it wraps every route (auth + team
 * scope); on a method it wraps that route only (uploads, rate limits). This is
 * the pollium `@Middleware` — guards live on the controller, not in a separate
 * mount layer.
 */
export const Middleware = (...middleware: RequestHandler[]): ClassDecorator & MethodDecorator =>
    ((target: object, handlerName?: string | symbol): void => {
        if (handlerName === undefined) {
            classMiddleware.set((target as { prototype: object }).prototype ? target : target, [
                ...(classMiddleware.get(target) ?? []),
                ...middleware
            ]);
            return;
        }
        const ctor = target.constructor;
        const map = handlerMiddleware.get(ctor) ?? new Map<string | symbol, RequestHandler[]>();
        map.set(handlerName, [...(map.get(handlerName) ?? []), ...middleware]);
        handlerMiddleware.set(ctor, map);
    }) as ClassDecorator & MethodDecorator;

const isPaginated = (value: unknown): value is PaginatedResult<unknown> =>
    typeof value === 'object' && value !== null
        && Array.isArray((value as PaginatedResult<unknown>).data)
        && typeof (value as PaginatedResult<unknown>).totalPages === 'number';

/**
 * Base for pollium-style controllers: methods are bound to wire endpoints with
 * `@Route(...)` and delegate to a service the controller `new`s itself. No route
 * file, no createHttpModule, no DI. `buildRouter()` turns the decorated methods
 * into an Express router; the router is mounted directly (the contract path is
 * absolute).
 */
export default abstract class Controller {
    buildRouter(): Router {
        const router = Router();
        const ctor = this.constructor;
        const classMws = classMiddleware.get(ctor) ?? [];

        for (const route of getRoutes(ctor)) {
            const method = (this as unknown as Record<string | symbol, (...args: unknown[]) => unknown>)[route.handlerName].bind(this);
            const resolvers = getParamResolvers(ctor, route.handlerName);
            const methodMws = handlerMiddleware.get(ctor)?.get(route.handlerName) ?? [];

            const handler: RequestHandler = async (req, res, next) => {
                try {
                    const args = await Promise.all(resolvers.map((resolve) => resolve(req as AuthenticatedRequest, res)));
                    const result = await method(...args);
                    this.#respond(res, result, route.statusCode);
                } catch (error) {
                    next(error);
                }
            };

            const verb = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
            router[verb](route.path, ...classMws, ...methodMws, handler);
        }

        return router;
    }

    #respond(res: Response, result: unknown, statusCode?: number): void {
        // Streaming / download handlers take `@Res()`, write the response
        // themselves and return void — once they've begun the response there is
        // nothing left to send here.
        if (res.headersSent || res.writableEnded) {
            return;
        }
        if (result === undefined || result === null) {
            res.status(statusCode ?? 204).send();
            return;
        }
        if (isPaginated(result)) {
            BaseResponse.paginated(res, result, result._meta);
            return;
        }
        BaseResponse.success(res, result, statusCode ?? 200);
    }
}
