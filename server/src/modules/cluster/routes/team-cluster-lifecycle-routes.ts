import ClusterController from '@modules/cluster/controllers/ClusterController';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(ClusterController);

export default createHttpModule({
    basePath: '/api/team-clusters/:teamClusterId',
    moduleKey: 'cluster',
    routes: (router) => {
        router.post(
            '/healthcheck',
            controller.processHealthcheck
        );
        router.post(
            '/install-manifest',
            controller.generateInstallManifest
        );
    }
});
