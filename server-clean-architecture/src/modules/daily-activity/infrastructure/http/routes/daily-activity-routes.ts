import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { checkTeamMembership } from '@/src/modules/team/infrastructure/http/middlewares/check-team-membership';
import FindActivityByTeamIdController from '../controllers/FindActivityByTeamIdController';

const findActivityByTeamIdController = container.resolve(FindActivityByTeamIdController);

const router = Router();

router.use(protect);

router.get('/:teamId/', checkTeamMembership, findActivityByTeamIdController.handle);

export default router;