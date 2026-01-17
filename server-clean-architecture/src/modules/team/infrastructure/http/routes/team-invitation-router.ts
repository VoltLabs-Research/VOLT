import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { checkTeamMembership } from '../middlewares/check-team-membership';
import controllers from '../controllers/team-invitation';

const router = Router();

router.use(protect);

router.post('/:teamId/invite', checkTeamMembership, controllers.send.handle);
router.get('/:teamId/pending', checkTeamMembership, controllers.listPendingByTeamId.handle);

router.route('/:teamId/:invitationId')
    .get(controllers.getById.handle)
    .patch(controllers.updateById.handle)
    .delete(controllers.deleteById.handle);

export default router;