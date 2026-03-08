import controllers from '@modules/team/infrastructure/http/controllers/team';
import { HttpModule, HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { Router } from 'express';

const router = Router({ mergeParams: true });

const module: HttpModule = {
    basePath: '/api/teams/:teamId/self',
    router,
    teamScope: HttpModuleTeamScope.BasePath
};

router.get('/permissions', controllers.getMyPermissions.handle);

router.delete('/membership', controllers.leave.handle);

export default module;
