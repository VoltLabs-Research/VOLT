import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';
import controllers from '../controllers/team-invitation';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/team/invitations/:teamId',
    router
};

router.use(protect);

router.post('/invite', controllers.send.handle);
router.get('/pending', controllers.listPendingByTeamId.handle);

router.route('/:invitationId')
    .get(controllers.getById.handle)
    .patch(controllers.updateById.handle)
    .delete(controllers.deleteById.handle);

export default module;