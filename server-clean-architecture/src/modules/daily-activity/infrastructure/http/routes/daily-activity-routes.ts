import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import controllers from '@modules/daily-activity/infrastructure/http/controllers';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/daily-activity/:teamId',
    router
};

router.use(protect);

router.get('/', controllers.getByTeamId.handle);

export default module;