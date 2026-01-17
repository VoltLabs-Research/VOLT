import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { checkTeamMembership } from '../middlewares/check-team-membership';
import controllers from '../controllers/team-member';

const router = Router();

router.use(protect);

router.route('/:teamId')
    .all(checkTeamMembership)
    .get(controllers.listByTeamId.handle);

router.route('/:teamId/:teamMemberId')
    .all(checkTeamMembership)
    .get(controllers.getById.handle)
    .patch(controllers.updateById.handle)
    .delete(controllers.deleteById.handle);

export default router;