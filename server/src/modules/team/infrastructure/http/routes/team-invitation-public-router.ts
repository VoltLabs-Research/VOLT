import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import controllers from '@modules/team/infrastructure/http/controllers/team-invitation';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/team/invitations',
    router
};

router.use(protect);

router.get('/:invitationId', controllers.getById.handle);
router.post('/:invitationId/accept', controllers.accept.handle);
router.post('/:invitationId/reject', controllers.reject.handle);

export default module;
