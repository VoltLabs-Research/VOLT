import { get, post } from '../../shared/routing';
import type { SystemConfig, SystemUpdateStatus } from './domain';

export const systemRoutes = {
    config: get<SystemConfig>('/api/system/config'),
    update: get<SystemUpdateStatus>('/api/system/update'),
    applyUpdate: post<never, SystemUpdateStatus>('/api/system/update')
} as const;
