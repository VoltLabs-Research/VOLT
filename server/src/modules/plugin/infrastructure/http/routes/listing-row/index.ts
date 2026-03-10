import controllers from '@modules/plugin/infrastructure/http/controllers/listing-row';

import { Resource } from '@core/constants/resources';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/plugins/:teamId',
    resource: Resource.PLUGIN,
    routes: (router) => {
        router.get('/listing-rows/analyses/:analysisId', controllers.getListingRowsByAnalysisId.handle);
        router.get('/listings/analyses/:analysisId', controllers.getListingRowsByAnalysisId.handle);
        router.get('/listing-rows/analyses/:analysisId/export', RATE_LIMIT_POLICIES.pluginExport, controllers.exportListingRowsByAnalysisId.handle);
        router.get('/listings/analyses/:analysisId/export', RATE_LIMIT_POLICIES.pluginExport, controllers.exportListingRowsByAnalysisId.handle);
        router.get('/listing-rows/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName', controllers.getSubListing.handle);
        router.get('/listings/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName', controllers.getSubListing.handle);
        router.get('/:pluginId/listing-rows/export', RATE_LIMIT_POLICIES.pluginExport, controllers.exportPluginListingDocuments.handle);
        router.get('/:pluginId/listings/export', RATE_LIMIT_POLICIES.pluginExport, controllers.exportPluginListingDocuments.handle);
        router.get('/:pluginId/listing-rows/trajectories/:trajectoryId/export', RATE_LIMIT_POLICIES.pluginExport, controllers.exportPluginListingDocuments.handle);
        router.get('/:pluginId/listings/trajectories/:trajectoryId/export', RATE_LIMIT_POLICIES.pluginExport, controllers.exportPluginListingDocuments.handle);
        router.get('/:pluginId/listing-rows', controllers.getPluginListingDocuments.handle);
        router.get('/:pluginId/listings', controllers.getPluginListingDocuments.handle);
    }
});
