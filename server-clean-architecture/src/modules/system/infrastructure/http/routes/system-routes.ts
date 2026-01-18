import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import controllers from '@modules/system/infrastructure/http/controllers';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const router = Router();
const module: HttpModule = {
    basePath: '/api/system',
    router
};

router.use(protect);

router.get('/stats', controllers.getSystemStats.handle);
router.get('/rbac', controllers.getRbacConfig.handle)

export default module;
