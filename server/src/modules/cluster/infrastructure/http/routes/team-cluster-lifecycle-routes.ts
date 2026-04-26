import controllers from '@modules/cluster/infrastructure/http/controllers';
import { teamClusterValidation } from '@modules/cluster/infrastructure/http/validation/team-cluster-schemas';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/team-clusters/:teamClusterId',
    routes: (router) => {
        router.post(
            '/healthcheck',
            teamClusterValidation.processHealthcheck,
            controllers.processHealthcheck.handle
        );
        router.post(
            '/install-manifest',
            teamClusterValidation.generateInstallManifest,
            controllers.generateInstallManifest.handle
        );
    }
});
