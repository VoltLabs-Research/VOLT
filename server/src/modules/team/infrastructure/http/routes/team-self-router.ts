import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';
import controllers from '@modules/team/infrastructure/http/controllers/team';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/team/self',
    router
};

router.use(protect);
router.get('/:teamId/permissions/me', controllers.getMyPermissions.handle);

export default module;
