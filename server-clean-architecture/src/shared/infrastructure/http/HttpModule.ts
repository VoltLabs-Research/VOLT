import { Router } from 'express';

export interface HttpModule {
    basePath: string;
    router: Router;
};