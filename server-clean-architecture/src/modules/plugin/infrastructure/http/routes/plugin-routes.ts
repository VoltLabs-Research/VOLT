import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import multer from 'multer';
import controllers from '../controllers/plugin';

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 }
});

router.use(protect);

router.get('/:teamId/schemas', controllers.getNodeSchemas.handle);
router.post('/:teamId/validate-workflow', controllers.validateWorkflow.handle);

router.get('/:teamId', controllers.listPlugins.handle);
router.post('/:teamId', controllers.create.handle);

router.post('/:teamId/:pluginId/binary', upload.single('file'), controllers.uploadBinary.handle);
router.delete('/:teamId/:pluginId/binary', controllers.deleteBinary.handle);

router.get('/:teamId/:pluginId/export', controllers.exportPlugin.handle);
router.post('/:teamId/import', upload.single('file'), controllers.importPlugin.handle);

router.route('/:teamId/:pluginId')
    .get(controllers.getPluginById.handle)
    .patch(controllers.updatePluginById.handle)
    .delete(controllers.deleteById.handle);

router.post('/:teamId/:pluginSlug/execute', controllers.executePlugin.handle);

export default router;
