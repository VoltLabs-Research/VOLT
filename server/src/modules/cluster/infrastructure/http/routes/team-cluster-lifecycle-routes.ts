import controllers from '@modules/cluster/infrastructure/http/controllers';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/team-clusters/:teamClusterId',
    routes: (router) => {
        router.post(
            '/healthcheck',
            controllers.processHealthcheck.handle
        );
        router.post(
            '/install-manifest',
            controllers.generateInstallManifest.handle
        );
    }
});
