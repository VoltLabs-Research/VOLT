import { Router } from 'express';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { Resource } from '@core/constants/resources';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { colorCodingValidation } from '@modules/trajectory/infrastructure/http/validation/color-coding-schemas';
import controllers from '@modules/trajectory/infrastructure/http/controllers/color-coding';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/color-coding/:teamId',
    router,
    resource: Resource.TRAJECTORY
};

const applyColorCodingRateLimit = createStandardRateLimiter(15);

router.get('/properties/:trajectoryId', colorCodingValidation.getProperties, controllers.getProperties.handle);
router.get('/stats/:trajectoryId', colorCodingValidation.getStats, controllers.getStats.handle);
router.get('/:trajectoryId', colorCodingValidation.getModel, controllers.get.handle);
router.post('/:trajectoryId', applyColorCodingRateLimit, colorCodingValidation.applyColorCoding, controllers.create.handle);

router.get('/properties/:trajectoryId/:analysisId', colorCodingValidation.getPropertiesByAnalysis, controllers.getProperties.handle);
router.get('/stats/:trajectoryId/:analysisId', colorCodingValidation.getStatsByAnalysis, controllers.getStats.handle);
router.get('/:trajectoryId/:analysisId', colorCodingValidation.getModelByAnalysis, controllers.get.handle);
router.post('/:trajectoryId/:analysisId', applyColorCodingRateLimit, colorCodingValidation.applyColorCodingByAnalysis, controllers.create.handle);

export default module;
