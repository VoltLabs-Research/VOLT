import { Resource } from '@core/constants/resources';
import { colorCodingValidation } from '@modules/trajectory/infrastructure/http/validation/color-coding';
import controllers from '@modules/trajectory/infrastructure/http/controllers/color-coding';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

export default createHttpModule({
    basePath: '/api/color-codings/:teamId',
    resource: Resource.TRAJECTORY,
    routes: (router) => {
        router.get('/:trajectoryId/properties', colorCodingValidation.getProperties, controllers.getProperties.handle);
        router.get('/:trajectoryId/stats', colorCodingValidation.getStats, controllers.getStats.handle);
        router.get('/:trajectoryId', colorCodingValidation.getModel, controllers.get.handle);
        router.post('/:trajectoryId', colorCodingValidation.applyColorCoding, controllers.create.handle);
        router.get('/:trajectoryId/properties/:analysisId', colorCodingValidation.getPropertiesByAnalysis, controllers.getProperties.handle);
        router.get('/:trajectoryId/stats/:analysisId', colorCodingValidation.getStatsByAnalysis, controllers.getStats.handle);
        router.get('/:trajectoryId/:analysisId', colorCodingValidation.getModelByAnalysis, controllers.get.handle);
        router.post(
            '/:trajectoryId/:analysisId',
            colorCodingValidation.applyColorCodingByAnalysis,
            controllers.create.handle
        );
    }
});
