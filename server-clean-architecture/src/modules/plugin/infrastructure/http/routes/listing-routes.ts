import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import controllers from '@modules/plugin/infrastructure/http/controllers/listing';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/plugin',
    router
};

router.use(protect);

router.get('/:pluginId/listing-documents', controllers.getPluginListingDocuments.handle);

export default module;
