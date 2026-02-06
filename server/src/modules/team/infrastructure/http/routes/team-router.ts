import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import controllers from '@modules/team/infrastructure/http/controllers/team';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/team',
    router
};

router.use(protect);

router.route('/')
    .get(controllers.listUserTeams.handle)
    .post(controllers.create.handle);

router.route('/:teamId')
    .get(controllers.getById.handle)
    .patch(controllers.updateById.handle)
    .delete(controllers.deleteById.handle);

router.post('/:teamId/members/remove', controllers.removeUserFromTeam.handle);
router.post('/:teamId/leave', controllers.leave.handle);
router.get('/:teamId/can-invite', controllers.checkInvitePermission.handle);

export default module;