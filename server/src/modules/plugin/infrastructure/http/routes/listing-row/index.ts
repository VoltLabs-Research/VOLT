import controllers from '@modules/plugin/infrastructure/http/controllers/listing-row';

import { Resource } from '@core/constants/resources';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/plugins/:teamId',
    resource: Resource.PLUGIN,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/listings/analyses/:analysisId', controllers.getListingRowsByAnalysisId.handle);
        router.get('/listings/analyses/:analysisId/export/options', controllers.getAnalysisListingExportOptions.handle);
        router.get('/listings/analyses/:analysisId/export', controllers.exportListingRowsByAnalysisId.handle);
        router.get('/listings/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName', controllers.getSubListing.handle);
        router.get('/:pluginId/listings/export', controllers.exportPluginListingDocuments.handle);
        router.get('/:pluginId/listings/trajectories/:trajectoryId/export', controllers.exportPluginListingDocuments.handle);
        router.get('/:pluginId/listings', controllers.getPluginListingDocuments.handle);
    }
});
