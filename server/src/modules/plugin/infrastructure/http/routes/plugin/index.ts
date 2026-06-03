import { pluginValidation } from '@modules/plugin/infrastructure/http/validation/plugin/plugin-schemas';
import controllers from '@modules/plugin/infrastructure/http/controllers/plugin';

import { Resource } from '@core/constants/resources';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import multer from 'multer';

const importUpload = multer({
    storage: multer.memoryStorage()
});

export default createHttpModule({
    basePath: '/api/plugins/:teamId',
    resource: Resource.PLUGIN,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/node-types/schema', controllers.getNodeTypesSchema.handle);
        router.post('/workflow-validation', pluginValidation.validateWorkflow, controllers.validateWorkflow.handle);
        router.get('/:pluginId/export', controllers.exportPlugin.handle);
        router.post('/import', importUpload.single('file'), controllers.importPlugin.handle);
        router.route('/')
            .get(controllers.listPlugins.handle)
            .post(pluginValidation.create, controllers.create.handle);
        router.post(
            '/:pluginId/binary/commit',
            pluginValidation.commitBinaryUpload,
            controllers.commitBinaryUpload.handle
        );
        router.route('/:pluginId/binary')
            .get(controllers.downloadBinary.handle)
            .patch(pluginValidation.uploadBinary, controllers.uploadBinary.handle)
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
