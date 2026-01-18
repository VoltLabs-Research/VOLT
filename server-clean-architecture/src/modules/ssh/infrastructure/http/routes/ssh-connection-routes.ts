import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import controllers from '@modules/ssh/infrastructure/http/controllers';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/ssh/connections/:teamId',
    router
};

router.use(protect);

router.route('/:teamId')
    .get(controllers.listByTeamId.handle)
    .post(controllers.create.handle);

router.route('/:teamId/:sshConnectionId')
    .patch(controllers.updateById.handle)
    .delete(controllers.deleteById.handle);

router.get('/:teamId/:sshConnectionId/files', controllers.listFiles.handle);

router.get('/:teamId/:sshConnectionId/test', controllers.testById.handle);

export default module;