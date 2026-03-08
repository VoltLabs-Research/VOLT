import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import controllers from '@modules/team/infrastructure/http/controllers/team-invitation';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/teams/invitations',
    router
};

router.use(protect);

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

export default module;
