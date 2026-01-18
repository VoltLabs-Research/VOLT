import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import controllers from '../controllers';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

const router = Router();
const module: HttpModule = {
    basePath: '/api/notification',
    router
};

router.use(protect);

router.get('/', controllers.getByUserId.handle);
router.patch('/read-all', controllers.readAll.handle);

export default module;