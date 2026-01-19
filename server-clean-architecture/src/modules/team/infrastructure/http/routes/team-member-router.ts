import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';
import controllers from '@modules/team/infrastructure/http/controllers/team-member';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/team/members/:teamId',
    router
};

router.use(protect);

router.route('/')
    .get(controllers.listByTeamId.handle);

router.route('/:teamMemberId')
    .get(controllers.getById.handle)
    .patch(controllers.updateById.handle)
    .delete(controllers.deleteById.handle);

export default module;