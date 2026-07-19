import type { Resource } from '@core/constants/resources';
import { Router } from 'express';
import type { RequestHandler, RouterOptions } from 'express';
import { HttpModuleTeamScope } from './HttpModule';
import type { HttpModule } from './HttpModule';

interface CreateHttpModuleConfig {
    basePath: string;
    resource?: Resource;
    teamScope?: HttpModuleTeamScope;
    protected?: boolean;
    authenticationMiddleware?: RequestHandler;
    routerOptions?: RouterOptions;
    moduleKey?: string;
    routes: (router: Router) => void;
}

export const createHttpModule = (config: CreateHttpModuleConfig): HttpModule => {
    const router = Router({ mergeParams: true, ...config.routerOptions });
    const isProtected = config.protected ?? Boolean(config.teamScope);
    const requiresAuthenticationMiddleware = isProtected && config.teamScope !== HttpModuleTeamScope.BasePath;

    if (requiresAuthenticationMiddleware) {
        const authenticationMiddleware = config.authenticationMiddleware;

        if (!authenticationMiddleware) {
            throw new Error('Protected HTTP modules require an authentication middleware');
        }

        router.use(authenticationMiddleware);
    }

    config.routes(router);

    return {
        basePath: config.basePath,
        protected: isProtected,
        router,
        resource: config.resource,
        teamScope: config.teamScope,
        moduleKey: config.moduleKey
    };
};
