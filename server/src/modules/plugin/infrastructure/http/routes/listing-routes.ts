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

router.get('/listing/analysis/:analysisId', controllers.getListingRowsByAnalysisId.handle);
router.get('/listing/analysis/:analysisId/export', controllers.exportListingRowsByAnalysisId.handle);
router.get('/listing/:pluginId/export', controllers.exportPluginListingDocuments.handle);
router.get('/listing/:pluginId/trajectory/:trajectoryId/export', controllers.exportPluginListingDocuments.handle);
router.get('/listing/:pluginId', controllers.getPluginListingDocuments.handle);

export default module;
