import type { SystemConfig } from '@volt/contracts/modules/system/domain';

const DEPLOYMENT_MODE: 'local' | 'cloud' = process.env.DEPLOYMENT_MODE === 'local' ? 'local' : 'cloud';

class SystemService{
    getConfig(): SystemConfig{
        return { mode: DEPLOYMENT_MODE };
    }
}

export default new SystemService();
