import { Router } from 'express';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { teamInvitationValidation } from '@modules/team/infrastructure/http/validation/team-invitation-schemas';
import controllers from '@modules/team/infrastructure/http/controllers/team-invitation';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/teams/:teamId/invitations',
    router,
    resource: Resource.TEAM_INVITATION
};

const sendInvitationRateLimit = createStandardRateLimiter(10);

router.post('/', sendInvitationRateLimit, teamInvitationValidation.send, controllers.send.handle);
router.get('/', controllers.listPendingByTeamId.handle);
router.delete('/:invitationId', controllers.deleteById.handle);
router.patch('/:invitationId', teamInvitationValidation.update, controllers.updateById.handle);

router.patch('/:invitationId/status', (req, res) => {
    const status = req.body?.status;
    if (status === 'accepted') {
        return controllers.accept.handle(req, res);
    }
    if (status === 'rejected') {
        return controllers.reject.handle(req, res);
    }
    return res.status(400).json({ message: 'Invalid status. Must be "accepted" or "rejected".' });
});

export default module;
