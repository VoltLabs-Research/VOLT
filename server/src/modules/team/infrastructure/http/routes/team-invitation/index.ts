import { Resource } from '@core/constants/resources';
import controllers from '@modules/team/infrastructure/http/controllers/team-invitation';
import { teamInvitationValidation } from '@modules/team/infrastructure/http/validation/team-invitation';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/teams/:teamId/invitations',
    resource: Resource.TEAM_INVITATION,
    routes: (router) => {
        router.post('/', teamInvitationValidation.send, controllers.send.handle);
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
    }
});
