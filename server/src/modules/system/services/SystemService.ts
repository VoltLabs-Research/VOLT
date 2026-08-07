import { Action } from '@core/constants/permissions';
import { Resource } from '@core/constants/resources';
import type { RbacConfig, SystemConfig } from '@volt/contracts/modules/system/domain';

const DEPLOYMENT_MODE: 'local' | 'cloud' = process.env.DEPLOYMENT_MODE === 'local' ? 'local' : 'cloud';

const toLabel = (key: string): string =>
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w+/g, (w) => w.toLowerCase());

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
        return { mode: DEPLOYMENT_MODE };
    }
}
