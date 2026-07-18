import { get } from '../../shared/routing';
import type { RbacConfig, SystemConfig } from './domain';

/**
 * Every client-facing system endpoint, typed by request/response. All paths are
 * the full wire paths (`/api/system`). `config` is PUBLIC (matches the previous
 * `SystemConfigHttpModule` with `protected: false`) so the client can read the
 * deployment mode + enabled-module set before authenticating; `rbac` is
 * authenticated (matches the previous protected `SystemHttpModule`). The
 * controller applies `protect` on `getRbac` only.
 */
export const systemRoutes = {
    config: get<SystemConfig>('/api/system/config'),
    rbac: get<RbacConfig>('/api/system/rbac')
} as const;
