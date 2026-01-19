import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';
import controllers from '@modules/team/infrastructure/http/controllers/team-invitation';

const router = Router({ mergeParams: true });
// TODO: FIX! This should have RBAC, but if so, the PATCH /:invitationId route 
// will not be accessible to users who want to accept/decline invitations.
const module: HttpModule = {
    basePath: '/api/team/invitations',
    router
};

router.use(protect);

router.post('/:teamId/invite', controllers.send.handle);
router.get('/:teamId/pending', controllers.listPendingByTeamId.handle);
router.delete('/:teamId/:invitationId', controllers.deleteById.handle);

router.route('/:invitationId')
    .get(controllers.getById.handle)
    .patch(controllers.updateById.handle);

router.post('/:invitationId/accept', controllers.accept.handle);
router.post('/:invitationId/reject', controllers.reject.handle);

export default module;