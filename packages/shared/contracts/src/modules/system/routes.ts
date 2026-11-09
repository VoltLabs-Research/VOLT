import { get, post } from '../../shared/routing';
import type { RbacConfig, SystemConfig, SystemUpdateStatus } from './domain';

export const systemRoutes = {
    config: get<SystemConfig>('/api/system/config'),
    rbac: get<RbacConfig>('/api/system/rbac'),
    update: get<SystemUpdateStatus>('/api/system/update'),
    applyUpdate: post<never, SystemUpdateStatus>('/api/system/update')
} as const;
