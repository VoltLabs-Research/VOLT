import PluginController from '@modules/plugin/controllers/PluginController';

import { Resource } from '@core/constants/resources';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { container } from 'tsyringe';

const controller = container.resolve(PluginController);

export default createHttpModule({
    basePath: '/api/plugins/:teamId',
    resource: Resource.PLUGIN,
    teamScope: HttpModuleTeamScope.BasePath,
    moduleKey: 'plugin',
    routes: (router) => {
        router.get('/listings/analyses/:analysisId', controller.getListingRowsByAnalysisId);
        router.get('/listings/analyses/:analysisId/export/options', controller.getAnalysisListingExportOptions);
        router.get('/listings/analyses/:analysisId/export', controller.exportListingRowsByAnalysisId);
        router.get('/listings/analyses/:analysisId/sub-listings/:exposureId/:timestep/:subListingName', controller.getSubListing);
        router.get('/:pluginId/listings/export', controller.exportPluginListingDocuments);
        router.get('/:pluginId/listings/trajectories/:trajectoryId/export', controller.exportPluginListingDocuments);
        router.get('/:pluginId/listings', controller.getPluginListingDocuments);
    }
});
