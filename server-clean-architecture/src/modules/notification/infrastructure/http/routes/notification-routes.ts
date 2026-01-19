import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import controllers from '@modules/notification/infrastructure/http/controllers';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/notification',
    router
};

router.use(protect);

router.get('/', controllers.getByUserId.handle);
router.patch('/read-all', controllers.readAll.handle);

export default module;