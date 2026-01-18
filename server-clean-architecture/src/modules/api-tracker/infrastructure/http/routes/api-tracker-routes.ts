import { Router } from 'express';
import { container } from 'tsyringe';
import { ListApiTrackerController } from '@modules/api-tracker/infrastructure/http/controllers/ListApiTrackerController';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const router = Router();
const module: HttpModule = {
    basePath: '/api/api-tracker',
    router
};

const listApiTrackerController = container.resolve(ListApiTrackerController);

router.use(protect);

router.get('/', listApiTrackerController.handle);

export default module;
