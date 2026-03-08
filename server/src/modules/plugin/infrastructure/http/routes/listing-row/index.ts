import controllers from '@modules/plugin/infrastructure/http/controllers/listing-row';

import { Resource } from '@core/constants/resources';
import { createExportRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { Router } from 'express';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/plugins/:teamId',
    router,
    resource: Resource.PLUGIN
};

const exportRateLimit = createExportRateLimiter(10);

router.get('/listing-rows/analyses/:analysisId', controllers.getListingRowsByAnalysisId.handle);
router.get('/listings/analyses/:analysisId', controllers.getListingRowsByAnalysisId.handle);
router.get('/listing-rows/analyses/:analysisId/export', exportRateLimit, controllers.exportListingRowsByAnalysisId.handle);
router.get('/listings/analyses/:analysisId/export', exportRateLimit, controllers.exportListingRowsByAnalysisId.handle);
router.get('/listing-rows/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName', controllers.getSubListing.handle);
router.get('/listings/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName', controllers.getSubListing.handle);
router.get('/:pluginId/listing-rows/export', exportRateLimit, controllers.exportPluginListingDocuments.handle);
router.get('/:pluginId/listings/export', exportRateLimit, controllers.exportPluginListingDocuments.handle);
router.get('/:pluginId/listing-rows/trajectories/:trajectoryId/export', exportRateLimit, controllers.exportPluginListingDocuments.handle);
router.get('/:pluginId/listings/trajectories/:trajectoryId/export', exportRateLimit, controllers.exportPluginListingDocuments.handle);
router.get('/:pluginId/listing-rows', controllers.getPluginListingDocuments.handle);
router.get('/:pluginId/listings', controllers.getPluginListingDocuments.handle);

export default module;
