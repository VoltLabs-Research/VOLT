import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import controllers from '../controllers';

const router = Router();

router.use(protect);

router.route('/:teamId')
    .get(controllers.listByTeamId.handle)
    .post(controllers.create.handle);

router.route('/:teamId/:sshConnectionId')
    .patch(controllers.updateById.handle)
    .delete(controllers.deleteById.handle);

router.get('/:teamId/:sshConnectionId/files', controllers.listFiles.handle);

router.get('/:teamId/:sshConnectionId/test', controllers.testById.handle);

export default router;