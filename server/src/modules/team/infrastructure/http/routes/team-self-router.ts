import { Router } from 'express';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import controllers from '@modules/team/infrastructure/http/controllers/team';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/teams/:teamId/self',
    router,
    teamScope: 'base-path'
};

router.get('/permissions', controllers.getMyPermissions.handle);
router.delete('/membership', controllers.leave.handle);

export default module;
