import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import controllers from '../controllers/listing';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

const router = Router();
const module: HttpModule = {
    basePath: '/api/plugin',
    router
};

router.use(protect);

router.get('/:pluginId/listing-documents', controllers.getPluginListingDocuments.handle);

export default module;
