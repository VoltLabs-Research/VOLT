import { Router } from 'express';
import { createExportRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import controllers from '@modules/plugin/infrastructure/http/controllers/listing';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/plugins/:teamId',
    router,
    resource: Resource.PLUGIN
};

const exportRateLimit = createExportRateLimiter(10);

router.get('/listings/analyses/:analysisId', controllers.getListingRowsByAnalysisId.handle);
router.get('/listings/analyses/:analysisId/export', exportRateLimit, controllers.exportListingRowsByAnalysisId.handle);
router.get('/listings/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName', controllers.getSubListing.handle);
router.get('/:pluginId/listings/export', exportRateLimit, controllers.exportPluginListingDocuments.handle);
router.get('/:pluginId/listings/trajectories/:trajectoryId/export', exportRateLimit, controllers.exportPluginListingDocuments.handle);
router.get('/:pluginId/listings', controllers.getPluginListingDocuments.handle);

export default module;
