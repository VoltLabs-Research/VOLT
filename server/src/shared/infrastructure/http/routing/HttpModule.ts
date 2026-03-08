import { Resource } from '@core/constants/resources';
import { Router } from 'express';

export enum HttpModuleTeamScope {
    BasePath = 'base-path',
    Param = 'param'
};

export const hasTeamIdInBasePath = (basePath: string): boolean => basePath.includes(':teamId');

export interface HttpModule {
    basePath: string;
    router: Router;
    resource?: Resource;
    teamScope?: HttpModuleTeamScope;
};
