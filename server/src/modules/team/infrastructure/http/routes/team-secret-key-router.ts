import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';
import controllers from '@modules/team/infrastructure/http/controllers/secret-key';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/team/secret-keys',
    router,
    resource: Resource.TEAM_SECRET_KEY
};

router.use(protect);
router.get('/me', controllers.current.handle);

router.get('/:teamId/metrics', controllers.teamMetrics.handle);
router.get('/:teamId/:secretKeyId/usage', controllers.keyUsage.handle);

router.route('/:teamId')
    .get(controllers.listByTeamId.handle)
    .post(controllers.create.handle);

router.patch('/:teamId/:secretKeyId/revoke', controllers.revokeById.handle);
router.delete('/:teamId/:secretKeyId', controllers.deleteById.handle);

export default module;
