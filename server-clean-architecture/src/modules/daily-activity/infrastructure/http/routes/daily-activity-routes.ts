import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { checkTeamMembership } from '@/src/modules/team/infrastructure/http/middlewares/check-team-membership';
import controllers from '../controllers';

const router = Router();

router.use(protect);

router.get('/:teamId/', checkTeamMembership, controllers.getByTeamId.handle);

export default router;