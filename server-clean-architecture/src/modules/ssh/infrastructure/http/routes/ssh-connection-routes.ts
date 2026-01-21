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

router.route('/')
    .get(controllers.listByTeamId.handle)
    .post(controllers.create.handle);

router.route('/:sshConnectionId')
    .patch(controllers.updateById.handle)
    .delete(controllers.deleteById.handle);

router.get('/:sshConnectionId/files', controllers.listFiles.handle);

router.get('/:sshConnectionId/test', controllers.testById.handle);

export default module;