import { pluginValidation } from '@modules/plugin/infrastructure/http/validation/plugin/plugin-schemas';
import controllers from '@modules/plugin/infrastructure/http/controllers/plugin';

import { Resource } from '@core/constants/resources';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import multer from 'multer';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 }
});

export default createHttpModule({
    basePath: '/api/plugins/:teamId',
    resource: Resource.PLUGIN,
    routes: (router) => {
        router.post('/workflow-validation', pluginValidation.validateWorkflow, controllers.validateWorkflow.handle);
        router.get('/:pluginId/export', controllers.exportPlugin.handle);
        router.post('/import', upload.single('file'), controllers.importPlugin.handle);
        router.route('/')
            .get(controllers.listPlugins.handle)
            .post(pluginValidation.create, controllers.create.handle);
        router.route('/:pluginId/binary')
            .patch(upload.single('file'), controllers.uploadBinary.handle)
            .delete(controllers.deleteBinary.handle);
        router.post('/:pluginId/clones', controllers.clone.handle);
        router.route('/:pluginId')
            .get(controllers.getPluginById.handle)
            .patch(pluginValidation.update, controllers.updatePluginById.handle)
            .delete(controllers.deleteById.handle);
        router.post(
            '/:pluginId/trajectories/:trajectoryId/executions',
            pluginValidation.execute,
            controllers.executePlugin.handle
        );
    }
});
