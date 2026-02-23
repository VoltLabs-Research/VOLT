import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { Resource } from '@core/constants/resources';
import controllers from '@modules/plugin/infrastructure/http/controllers/listing';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/plugin/:teamId',
    router,
    resource: Resource.PLUGIN
};

router.use(protect);

router.get('/listing/:pluginId/export', controllers.exportPluginListingDocuments.handle);
router.get('/listing/:pluginId/trajectory/:trajectoryId/export', controllers.exportPluginListingDocuments.handle);
router.get('/listing/:pluginId/exposure/:exposureId', controllers.getPluginListingDocuments.handle);
router.get('/listing/:pluginId/exposure/:exposureId/:trajectoryId', controllers.getPluginListingDocuments.handle);
router.get('/listing/:pluginId/:exposureName', controllers.getPluginListingDocuments.handle);
router.get('/listing/:pluginId/:exposureName/:trajectoryId', controllers.getPluginListingDocuments.handle);

export default module;
