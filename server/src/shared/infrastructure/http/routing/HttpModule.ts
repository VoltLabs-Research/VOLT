import { Resource } from '@core/constants/resources';
import { Router } from 'express';

export enum HttpModuleTeamScope {
    BasePath = 'base-path',
    Param = 'param'
};

export interface HttpModule {
    basePath: string;
    router: Router;
    protected?: boolean;
    resource?: Resource;
    teamScope?: HttpModuleTeamScope;
};
