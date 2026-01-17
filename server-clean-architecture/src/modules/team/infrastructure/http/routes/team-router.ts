import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { checkTeamMembership } from '../middlewares/check-team-membership';
import controllers from '../controllers/team';

const router = Router();

router.use(protect);

router.route('/')
    .get(controllers.listUserTeams.handle)
    .post(controllers.create.handle);

router.route('/:teamId')
    .all(checkTeamMembership)
    .get(controllers.getById.handle)
    .patch(controllers.updateById.handle)
    .delete(controllers.deleteById.handle);

router.post('/:teamId/members/remove', controllers.removeUserFromTeam.handle);

export default router;