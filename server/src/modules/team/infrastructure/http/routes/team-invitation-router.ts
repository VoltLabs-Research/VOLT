import { Router } from 'express';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { teamInvitationValidation } from '@modules/team/infrastructure/http/validation/team-invitation-schemas';
import controllers from '@modules/team/infrastructure/http/controllers/team-invitation';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/team/:teamId/invitations',
    router,
    resource: Resource.TEAM_INVITATION
};

const sendInvitationRateLimit = createStandardRateLimiter(10);

router.post('/invite', sendInvitationRateLimit, teamInvitationValidation.send, controllers.send.handle);
router.get('/pending', controllers.listPendingByTeamId.handle);
router.delete('/:invitationId', controllers.deleteById.handle);
router.patch('/:invitationId', teamInvitationValidation.update, controllers.updateById.handle);

router.post('/:invitationId/accept', controllers.accept.handle);
router.post('/:invitationId/reject', controllers.reject.handle);

export default module;
