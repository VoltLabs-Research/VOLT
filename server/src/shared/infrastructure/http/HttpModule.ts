import { Router } from 'express';
import { Resource } from '@core/constants/resources';

export interface HttpModule {
    basePath: string;
    router: Router;
    resource?: Resource;
};