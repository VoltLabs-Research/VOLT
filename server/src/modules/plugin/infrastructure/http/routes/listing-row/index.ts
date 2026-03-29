import { listingRowValidation } from '@modules/plugin/infrastructure/http/validation/listing-row/listing-row-schemas';
import controllers from '@modules/plugin/infrastructure/http/controllers/listing-row';

import { Resource } from '@core/constants/resources';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/plugins/:teamId',
    resource: Resource.PLUGIN,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/listings/analyses/:analysisId', listingRowValidation.getListingRowsByAnalysisId, controllers.getListingRowsByAnalysisId.handle);
        router.get('/listings/analyses/:analysisId/export/options', listingRowValidation.getAnalysisListingExportOptions, controllers.getAnalysisListingExportOptions.handle);
        router.get('/listings/analyses/:analysisId/export', listingRowValidation.exportListingRowsByAnalysisId, controllers.exportListingRowsByAnalysisId.handle);
        router.get('/listings/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName', listingRowValidation.getSubListing, controllers.getSubListing.handle);
        router.get('/:pluginId/listings/export', listingRowValidation.exportPluginListingDocuments, controllers.exportPluginListingDocuments.handle);
        router.get('/:pluginId/listings/trajectories/:trajectoryId/export', listingRowValidation.exportPluginTrajectoryListingDocuments, controllers.exportPluginListingDocuments.handle);
        router.get('/:pluginId/listings', listingRowValidation.getPluginListingDocuments, controllers.getPluginListingDocuments.handle);
    }
});
