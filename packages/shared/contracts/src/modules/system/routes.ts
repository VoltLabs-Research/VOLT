import { get } from '../../shared/routing';
import type { RbacConfig, SystemConfig } from './domain';

export const systemRoutes = {
    config: get<SystemConfig>('/api/system/config'),
    rbac: get<RbacConfig>('/api/system/rbac')
} as const;
