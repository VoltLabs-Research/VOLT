import type { Resource } from '@core/constants/resources';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Router } from 'express';
import type { RouterOptions } from 'express';
import { HttpModuleTeamScope } from './HttpModule';
import type { HttpModule } from './HttpModule';

interface CreateHttpModuleConfig {
    basePath: string;
    resource?: Resource;
    teamScope?: HttpModuleTeamScope;
    protected?: boolean;
    routerOptions?: RouterOptions;
    routes: (router: Router) => void;
}

export const createHttpModule = (config: CreateHttpModuleConfig): HttpModule => {
    const router = Router({ mergeParams: true, ...config.routerOptions });
    const isProtected = config.protected ?? Boolean(config.teamScope);

    if (isProtected && config.teamScope !== HttpModuleTeamScope.BasePath) {
        router.use(protect);
    }

    config.routes(router);

    return {
        basePath: config.basePath,
        protected: isProtected,
        router,
        resource: config.resource,
        teamScope: config.teamScope
    };
};
