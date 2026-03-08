import { Router } from 'express';
import { Resource } from '@core/constants/resources';

export type HttpModuleTeamScope = 'base-path' | 'param';

export interface HttpModule {
    basePath: string;
    router: Router;
    resource?: Resource;
    teamScope?: HttpModuleTeamScope;
};