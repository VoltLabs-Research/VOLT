import { Router } from 'express';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { particleFilterValidation } from '@modules/trajectory/infrastructure/http/validation/particle-filter-schemas';
import controllers from '@modules/trajectory/infrastructure/http/controllers/particle-filter';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/particle-filter/:teamId',
    router,
    resource: Resource.TRAJECTORY
};

const applyFilterRateLimit = createStandardRateLimiter(15);

router.get('/properties/:trajectoryId', particleFilterValidation.getProperties, controllers.getProperties.handle);
router.get('/preview/:trajectoryId', particleFilterValidation.preview, controllers.preview.handle);
router.get('/unique-values/:trajectoryId', particleFilterValidation.getUniqueValues, controllers.getUniqueValues.handle);
router.get('/:trajectoryId', particleFilterValidation.getModel, controllers.get.handle);
router.post('/:trajectoryId', applyFilterRateLimit, particleFilterValidation.applyFilter, controllers.applyAction.handle);

router.get('/properties/:trajectoryId/:analysisId', particleFilterValidation.getPropertiesByAnalysis, controllers.getProperties.handle);
router.get('/preview/:trajectoryId/:analysisId', particleFilterValidation.previewByAnalysis, controllers.preview.handle);
router.get('/unique-values/:trajectoryId/:analysisId', particleFilterValidation.getUniqueValuesByAnalysis, controllers.getUniqueValues.handle);
router.get('/:trajectoryId/:analysisId', particleFilterValidation.getModelByAnalysis, controllers.get.handle);
router.post('/:trajectoryId/:analysisId', applyFilterRateLimit, particleFilterValidation.applyFilterByAnalysis, controllers.applyAction.handle);

export default module;
