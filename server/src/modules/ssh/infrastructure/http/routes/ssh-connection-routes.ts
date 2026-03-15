import { Resource } from '@core/constants/resources';
import controllers from '@modules/ssh/infrastructure/http/controllers';
import { sshConnectionValidation } from '@modules/ssh/infrastructure/http/validation/ssh-schemas';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/ssh/connections/:teamId',
    resource: Resource.SSH_CONNECTION,
    routes: (router) => {
        router.get('/', sshConnectionValidation.listByTeamId, controllers.listByTeamId.handle);
        router.post('/', sshConnectionValidation.create, controllers.create.handle);
        router.route('/:sshConnectionId')
            .get(sshConnectionValidation.getById, controllers.getById.handle)
            .patch(sshConnectionValidation.update, controllers.updateById.handle)
            .delete(sshConnectionValidation.deleteById, controllers.deleteById.handle);
        router.get('/:sshConnectionId/files', sshConnectionValidation.listFiles, controllers.listFiles.handle);
        router.post(
            '/:sshConnectionId/connection-tests',
            sshConnectionValidation.testById,
            controllers.testById.handle
        );
        router.post('/:sshConnectionId/imports', sshConnectionValidation.importTrajectory, controllers.importTrajectory.handle);
    }
});
