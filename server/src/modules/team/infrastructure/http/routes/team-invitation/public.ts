import controllers from '@modules/team/infrastructure/http/controllers/team-invitation';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/teams/invitations',
    protected: true,
    routes: (router) => {
        router.get('/:invitationId', controllers.getById.handle);
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
