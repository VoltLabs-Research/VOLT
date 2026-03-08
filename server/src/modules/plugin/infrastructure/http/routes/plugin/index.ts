import { pluginValidation } from '@modules/plugin/infrastructure/http/validation/plugin/plugin-schemas';
import controllers from '@modules/plugin/infrastructure/http/controllers/plugin';

import { Resource } from '@core/constants/resources';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { Router } from 'express';
import multer from 'multer';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/plugins/:teamId',
    router,
    resource: Resource.PLUGIN
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 }
});

const executeRateLimit = createStandardRateLimiter(10);

const importAndBinaryRateLimit = createStandardRateLimiter(3);

const createPluginRateLimit = createStandardRateLimiter(15);

const cloneRateLimit = createStandardRateLimiter(10);

const exportRateLimit = createStandardRateLimiter(10);

router.get('/schemas', controllers.getNodeSchemas.handle);
router.post('/workflow-validation', pluginValidation.validateWorkflow, controllers.validateWorkflow.handle);

router.get('/:pluginId/export', exportRateLimit, controllers.exportPlugin.handle);
router.post('/import', importAndBinaryRateLimit, upload.single('file'), controllers.importPlugin.handle);

router.route('/')
    .get(controllers.listPlugins.handle)
    .post(createPluginRateLimit, pluginValidation.create, controllers.create.handle);

router.route('/:pluginId/binary')
    .patch(importAndBinaryRateLimit, upload.single('file'), controllers.uploadBinary.handle)
    .delete(controllers.deleteBinary.handle);

router.post('/:pluginId/clones', cloneRateLimit, controllers.clone.handle);

router.route('/:pluginId')
    .get(controllers.getPluginById.handle)
    .patch(pluginValidation.update, controllers.updatePluginById.handle)
    .delete(controllers.deleteById.handle);

router.post('/:pluginId/trajectories/:trajectoryId/executions', executeRateLimit, controllers.executePlugin.handle);

export default module;
