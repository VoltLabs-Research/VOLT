import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { checkTeamMembership } from '../middlewares/check-team-membership';
import controllers from '../controllers/team-role';

const router = Router();

router.use(protect);

router.route('/:teamId')
    .all(checkTeamMembership)
    .get(controllers.listByTeamId.handle)
    .post(controllers.create.handle);

router.route('/:teamId/:roleId')
    .all(checkTeamMembership)
    .delete(controllers.deleteById.handle)
    .get(controllers.getById.handle)
    .patch(controllers.updateById.handle);

export default router;