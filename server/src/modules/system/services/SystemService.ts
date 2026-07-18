import { Action } from '@core/constants/permissions';
import { Resource } from '@core/constants/resources';
import { getEnabledModules } from '@core/bootstrap/module-state';
import type { RbacConfig, SystemConfig } from '@volt/contracts/modules/system/domain';

const DEPLOYMENT_MODE: 'local' | 'cloud' = process.env.DEPLOYMENT_MODE === 'local' ? 'local' : 'cloud';

const toLabel = (key: string): string =>
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w+/g, (w) => w.toLowerCase());

/**
 * The single application service for the system module (pollium style). Folds
 * the two previously inline route handlers: the RBAC vocabulary the old
 * protected `SystemHttpModule` served at `/rbac`, and the boot config the old
 * public `SystemConfigHttpModule` served at `/config`. No DB, no DI — pure
 * derivation from the compiled `Resource`/`Action` enums and the resolved
 * enabled-module set. The system module's genuinely-stateful pieces (the Redis
 * metrics repository, the deployment-settings repository) are separate
 * cross-module singletons; this service does not touch them.
 */
export default class SystemService{
    getRbac(): RbacConfig{
        return {
            resources: Object.entries(Resource).map(([enumKey, value]) => ({
                key: value,
                label: toLabel(enumKey)
            })),
            actions: Object.entries(Action).map(([enumKey, value]) => ({
                key: value,
                label: toLabel(enumKey)
            }))
        };
    }

    getConfig(): SystemConfig{
        const enabledModules = [...getEnabledModules()].sort();
        return { mode: DEPLOYMENT_MODE, enabledModules };
    }
}
