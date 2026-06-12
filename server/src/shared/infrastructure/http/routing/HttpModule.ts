import { Resource } from '@core/constants/resources';
import { Router } from 'express';

export enum HttpModuleTeamScope {
    BasePath = 'base-path',
    Param = 'param'
}

export interface HttpModule {
    basePath: string;
    router: Router;
    protected?: boolean;
    resource?: Resource;
    teamScope?: HttpModuleTeamScope;
    /**
     * The detachable-module key this route group belongs to (e.g. 'latex').
     * When set, the route group is only mounted if that module is enabled in the
     * resolved {@link import('@shared/infrastructure/modules/ModuleRegistry')}
     * set. Routes with no `moduleKey` are treated as always-on (kernel/shared).
     */
    moduleKey?: string;
}
