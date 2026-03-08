import { Router } from 'express';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import controllers from '@modules/ssh/infrastructure/http/controllers';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { sshConnectionValidation } from '@modules/ssh/infrastructure/http/validation/ssh-schemas';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/ssh/connections/:teamId',
    router,
    resource: Resource.SSH_CONNECTION
};

const createConnectionLimiter = createStandardRateLimiter(10);

const testConnectionLimiter = createStandardRateLimiter(10);

router.get('/', sshConnectionValidation.listByTeamId, controllers.listByTeamId.handle);
router.post('/', createConnectionLimiter, sshConnectionValidation.create, controllers.create.handle);

router.route('/:sshConnectionId')
    .get(sshConnectionValidation.getById, controllers.getById.handle)
    .patch(sshConnectionValidation.update, controllers.updateById.handle)
    .delete(sshConnectionValidation.deleteById, controllers.deleteById.handle);

router.get('/:sshConnectionId/files', sshConnectionValidation.listFiles, controllers.listFiles.handle);
router.post('/:sshConnectionId/connection-tests', testConnectionLimiter, sshConnectionValidation.testById, controllers.testById.handle);
router.post('/:sshConnectionId/imports', sshConnectionValidation.importTrajectory, controllers.importTrajectory.handle);

export default module;
