import type { Resource } from '@core/constants/resources';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Router } from 'express';
import type { RequestHandler, RouterOptions } from 'express';
import { HttpModuleTeamScope } from './HttpModule';
import type { HttpModule } from './HttpModule';

interface CreateHttpModuleConfig {
    basePath: string;
    resource?: Resource;
    teamScope?: HttpModuleTeamScope;
    protected?: boolean;
    middleware?: RequestHandler | RequestHandler[];
    routerOptions?: RouterOptions;
    routes: (router: Router) => void;
}

const normalizeMiddleware = (middleware?: RequestHandler | RequestHandler[]): RequestHandler[] => {
    if (!middleware) {
        return [];
    }

    return Array.isArray(middleware) ? middleware : [middleware];
};

export const createHttpModule = (config: CreateHttpModuleConfig): HttpModule => {
    const router = Router({ mergeParams: true, ...config.routerOptions });

    if (config.protected && config.teamScope !== HttpModuleTeamScope.BasePath) {
        router.use(protect);
    }

    for (const middleware of normalizeMiddleware(config.middleware)) {
        router.use(middleware);
    }

    config.routes(router);

    return {
        basePath: config.basePath,
        router,
        resource: config.resource,
        teamScope: config.teamScope
    };
};
