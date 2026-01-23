import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import multer from 'multer';
import controllers from '@modules/plugin/infrastructure/http/controllers/plugin';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/plugin/:teamId',
    router
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 }
});

router.use(protect);

router.get('/schemas', controllers.getNodeSchemas.handle);
router.post('/validate-workflow', controllers.validateWorkflow.handle);

router.get('/:pluginId/export', controllers.exportPlugin.handle);
router.post('/import', upload.single('file'), controllers.importPlugin.handle);

router.route('/')
    .get(controllers.listPlugins.handle)
    .post(controllers.create.handle);

router.route('/:pluginId/binary')
    .post(upload.single('file'), controllers.uploadBinary.handle)
    .delete(controllers.deleteBinary.handle);

router.route('/:pluginId')
    .get(controllers.getPluginById.handle)
    .patch(controllers.updatePluginById.handle)
    .delete(controllers.deleteById.handle);

router.post('/:pluginSlug/trajectory/:trajectoryId/execute', controllers.executePlugin.handle);

export default module;
