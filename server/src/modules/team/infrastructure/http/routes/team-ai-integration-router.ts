import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';
import controllers from '@modules/team/infrastructure/http/controllers/ai-integration';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/team/ai-integrations',
    router,
    resource: Resource.TEAM
};

router.use(protect);

router.get('/:teamId/models', controllers.listModels.handle);

router.route('/:teamId')
    .get(controllers.listByTeamId.handle);

router.route('/:teamId/:provider')
    .post(controllers.createByProvider.handle)
    .patch(controllers.updateByProvider.handle)
    .delete(controllers.deleteByProvider.handle);

export default module;
