import { Resource } from '@core/constants/resources';
import { particleFilterValidation } from '@modules/trajectory/infrastructure/http/validation/particle-filter';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import controllers from '@modules/trajectory/infrastructure/http/controllers/particle-filter';

import { Router } from 'express';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/particle-filters/:teamId',
    router,
    resource: Resource.TRAJECTORY
};

const applyFilterRateLimit = createStandardRateLimiter(15);

router.get('/:trajectoryId/properties', particleFilterValidation.getProperties, controllers.getProperties.handle);
router.get('/:trajectoryId/previews', particleFilterValidation.preview, controllers.preview.handle);
router.get('/:trajectoryId/unique-values', particleFilterValidation.getUniqueValues, controllers.getUniqueValues.handle);
router.get('/:trajectoryId', particleFilterValidation.getModel, controllers.get.handle);
router.post('/:trajectoryId', applyFilterRateLimit, particleFilterValidation.applyFilter, controllers.applyAction.handle);

router.get('/:trajectoryId/properties/:analysisId', particleFilterValidation.getPropertiesByAnalysis, controllers.getProperties.handle);
router.get('/:trajectoryId/previews/:analysisId', particleFilterValidation.previewByAnalysis, controllers.preview.handle);
router.get('/:trajectoryId/unique-values/:analysisId', particleFilterValidation.getUniqueValuesByAnalysis, controllers.getUniqueValues.handle);
router.get('/:trajectoryId/:analysisId', particleFilterValidation.getModelByAnalysis, controllers.get.handle);
router.post('/:trajectoryId/:analysisId', applyFilterRateLimit, particleFilterValidation.applyFilterByAnalysis, controllers.applyAction.handle);

export default module;
