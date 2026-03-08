import { Resource } from '@core/constants/resources';
import { colorCodingValidation } from '@modules/trajectory/infrastructure/http/validation/color-coding';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import controllers from '@modules/trajectory/infrastructure/http/controllers/color-coding';

import { Router } from 'express';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/color-codings/:teamId',
    router,
    resource: Resource.TRAJECTORY
};

const applyColorCodingRateLimit = createStandardRateLimiter(15);

router.get('/:trajectoryId/properties', colorCodingValidation.getProperties, controllers.getProperties.handle);
router.get('/:trajectoryId/stats', colorCodingValidation.getStats, controllers.getStats.handle);
router.get('/:trajectoryId', colorCodingValidation.getModel, controllers.get.handle);
router.post('/:trajectoryId', applyColorCodingRateLimit, colorCodingValidation.applyColorCoding, controllers.create.handle);

router.get('/:trajectoryId/properties/:analysisId', colorCodingValidation.getPropertiesByAnalysis, controllers.getProperties.handle);
router.get('/:trajectoryId/stats/:analysisId', colorCodingValidation.getStatsByAnalysis, controllers.getStats.handle);
router.get('/:trajectoryId/:analysisId', colorCodingValidation.getModelByAnalysis, controllers.get.handle);
router.post('/:trajectoryId/:analysisId', applyColorCodingRateLimit, colorCodingValidation.applyColorCodingByAnalysis, controllers.create.handle);

export default module;
