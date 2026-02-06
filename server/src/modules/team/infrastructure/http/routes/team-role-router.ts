import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';
import controllers from '@modules/team/infrastructure/http/controllers/team-role';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/team/roles/:teamId',
    router
};

router.use(protect);

router.route('/')
    .get(controllers.listByTeamId.handle)
    .post(controllers.create.handle);

router.route('/:roleId')
    .delete(controllers.deleteById.handle)
    .get(controllers.getById.handle)
    .patch(controllers.updateById.handle);

export default module;