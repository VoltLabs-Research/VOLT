import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';
import controllers from '@modules/team/infrastructure/http/controllers/secret-key';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/team/secret-keys',
    router,
    resource: Resource.TEAM
};

router.use(protect);
router.get('/me', controllers.current.handle);

router.route('/:teamId')
    .get(controllers.listByTeamId.handle)
    .post(controllers.create.handle);

router.delete('/:teamId/:secretKeyId', controllers.revokeById.handle);

export default module;
