import { listingRowValidation } from '@modules/plugin/infrastructure/http/validation/listing-row/listing-row-schemas';
import controllers from '@modules/plugin/infrastructure/http/controllers/listing-row';

import { Resource } from '@core/constants/resources';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/plugins/:teamId',
    resource: Resource.PLUGIN,
    routes: (router) => {
        router.get('/listing-rows/analyses/:analysisId', listingRowValidation.getListingRowsByAnalysisId, controllers.getListingRowsByAnalysisId.handle);
        router.get('/listings/analyses/:analysisId', listingRowValidation.getListingRowsByAnalysisId, controllers.getListingRowsByAnalysisId.handle);
        router.get('/listing-rows/analyses/:analysisId/export', RATE_LIMIT_POLICIES.pluginExport, listingRowValidation.exportListingRowsByAnalysisId, controllers.exportListingRowsByAnalysisId.handle);
        router.get('/listings/analyses/:analysisId/export', RATE_LIMIT_POLICIES.pluginExport, listingRowValidation.exportListingRowsByAnalysisId, controllers.exportListingRowsByAnalysisId.handle);
        router.get('/listing-rows/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName', listingRowValidation.getSubListing, controllers.getSubListing.handle);
        router.get('/listings/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName', listingRowValidation.getSubListing, controllers.getSubListing.handle);
        router.get('/:pluginId/listing-rows/export', RATE_LIMIT_POLICIES.pluginExport, listingRowValidation.exportPluginListingDocuments, controllers.exportPluginListingDocuments.handle);
        router.get('/:pluginId/listings/export', RATE_LIMIT_POLICIES.pluginExport, listingRowValidation.exportPluginListingDocuments, controllers.exportPluginListingDocuments.handle);
        router.get('/:pluginId/listing-rows/trajectories/:trajectoryId/export', RATE_LIMIT_POLICIES.pluginExport, listingRowValidation.exportPluginTrajectoryListingDocuments, controllers.exportPluginListingDocuments.handle);
        router.get('/:pluginId/listings/trajectories/:trajectoryId/export', RATE_LIMIT_POLICIES.pluginExport, listingRowValidation.exportPluginTrajectoryListingDocuments, controllers.exportPluginListingDocuments.handle);
        router.get('/:pluginId/listing-rows', listingRowValidation.getPluginListingDocuments, controllers.getPluginListingDocuments.handle);
        router.get('/:pluginId/listings', listingRowValidation.getPluginListingDocuments, controllers.getPluginListingDocuments.handle);
    }
});
