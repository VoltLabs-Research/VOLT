import { Router } from 'express';
import { container } from 'tsyringe';
import { ListApiTrackerController } from '../controllers/ListApiTrackerController';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

const router = Router();
const module: HttpModule = {
    basePath: '/api/api-tracker',
    router
};

const listApiTrackerController = container.resolve(ListApiTrackerController);

router.use(protect);

router.get('/', listApiTrackerController.handle);

export default module;
