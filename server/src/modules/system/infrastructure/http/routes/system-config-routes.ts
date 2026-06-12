import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { readStringArrayEnv } from '@shared/infrastructure/utilities/env';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';
import type { IDeploymentSettingsRepository } from '@modules/system/domain/port/IDeploymentSettingsRepository';
import { container } from 'tsyringe';

const mode = process.env.DEPLOYMENT_MODE === 'local' ? 'local' : 'cloud';

// Public, unauthenticated: the client reads this at boot to decide single-tenant UI.
// Shares the /api/system base path with the protected system module, so it MUST be
// registered before it (see mount-http-routes) to bypass that module's `protect`.
export default createHttpModule({
    basePath: '/api/system',
    protected: false,
    routes: (router) => {
        router.get('/config', async (_req, res) => {
            // Env override wins; otherwise the persisted setting; null on both = "all modules enabled".
            const envModules = readStringArrayEnv('VOLT_MODULES', null);
            let enabledModules: string[] | null = envModules;
            if (enabledModules === null) {
                const deploymentSettingsRepository = container.resolve<IDeploymentSettingsRepository>(
                    SYSTEM_TOKENS.DeploymentSettingsRepository
                );
                const settings = await deploymentSettingsRepository.getSettings();
                enabledModules = settings.props.enabledModules;
            }

            BaseResponse.success(res, { mode, enabledModules });
        });
    }
});
