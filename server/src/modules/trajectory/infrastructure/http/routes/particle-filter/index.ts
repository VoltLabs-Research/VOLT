import { Resource } from '@core/constants/resources';
import { particleFilterValidation } from '@modules/trajectory/infrastructure/http/validation/particle-filter';
import controllers from '@modules/trajectory/infrastructure/http/controllers/particle-filter';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/particle-filters/:teamId',
    resource: Resource.TRAJECTORY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/:trajectoryId/properties', particleFilterValidation.getProperties, controllers.getProperties.handle);
        router.get('/:trajectoryId/previews', particleFilterValidation.preview, controllers.preview.handle);
        router.get('/:trajectoryId/unique-values', particleFilterValidation.getUniqueValues, controllers.getUniqueValues.handle);
        router.get('/:trajectoryId', particleFilterValidation.getModel, controllers.get.handle);
        router.post('/:trajectoryId', particleFilterValidation.applyFilter, controllers.applyAction.handle);
        router.get('/:trajectoryId/properties/:analysisId', particleFilterValidation.getPropertiesByAnalysis, controllers.getProperties.handle);
        router.get('/:trajectoryId/previews/:analysisId', particleFilterValidation.previewByAnalysis, controllers.preview.handle);
        router.get('/:trajectoryId/unique-values/:analysisId', particleFilterValidation.getUniqueValuesByAnalysis, controllers.getUniqueValues.handle);
        router.get('/:trajectoryId/:analysisId', particleFilterValidation.getModelByAnalysis, controllers.get.handle);
        router.post(
            '/:trajectoryId/:analysisId',
            particleFilterValidation.applyFilterByAnalysis,
            controllers.applyAction.handle
        );
    }
});
