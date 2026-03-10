import controllers from '@modules/team-cluster/infrastructure/http/controllers';
import { teamClusterValidation } from '@modules/team-cluster/infrastructure/http/validation/team-cluster-schemas';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/team-clusters/:teamClusterId',
    routes: (router) => {
        router.post(
            '/healthcheck',
            RATE_LIMIT_POLICIES.teamClusterLifecycle,
            teamClusterValidation.processHealthcheck,
            controllers.processHealthcheck.handle
        );
        router.post(
            '/install-manifest',
            RATE_LIMIT_POLICIES.teamClusterLifecycle,
            teamClusterValidation.generateInstallManifest,
            controllers.generateInstallManifest.handle
        );
    }
});
