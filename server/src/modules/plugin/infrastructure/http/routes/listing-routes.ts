import { Router } from 'express';
import { createExportRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import controllers from '@modules/plugin/infrastructure/http/controllers/listing';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/plugin/:teamId',
    router,
    resource: Resource.PLUGIN
};

const exportRateLimit = createExportRateLimiter(10);

router.get('/listing/analysis/:analysisId', controllers.getListingRowsByAnalysisId.handle);
router.get('/listing/analysis/:analysisId/export', exportRateLimit, controllers.exportListingRowsByAnalysisId.handle);
router.get('/listing/analysis/:analysisId/sub-listing/:exposureId/:timestep/:subListingName', controllers.getSubListing.handle);
router.get('/listing/:pluginId/export', exportRateLimit, controllers.exportPluginListingDocuments.handle);
router.get('/listing/:pluginId/trajectory/:trajectoryId/export', exportRateLimit, controllers.exportPluginListingDocuments.handle);
router.get('/listing/:pluginId', controllers.getPluginListingDocuments.handle);

export default module;
