import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import CreatePluginController from '../controllers/plugin/CreatePluginController';
import GetPluginByIdController from '../controllers/plugin/GetPluginByIdController';
import UpdatePluginByIdController from '../controllers/plugin/UpdatePluginByIdController';
import DeletePluginByIdController from '../controllers/plugin/DeletePluginByIdController';
import ListPluginsController from '../controllers/plugin/ListPluginsController';
import ExecutePluginController from '../controllers/plugin/ExecutePluginController';
import ValidateWorkflowController from '../controllers/plugin/ValidateWorkflowController';
import GetNodeSchemasController from '../controllers/plugin/GetNodeSchemasController';
import UploadBinaryController from '../controllers/plugin/UploadBinaryController';
import DeleteBinaryController from '../controllers/plugin/DeleteBinaryController';
import ExportPluginController from '../controllers/plugin/ExportPluginController';
import ImportPluginController from '../controllers/plugin/ImportPluginController';
import multer from 'multer';

const createPluginController = container.resolve(CreatePluginController);
const getPluginByIdController = container.resolve(GetPluginByIdController);
const updatePluginByIdController = container.resolve(UpdatePluginByIdController);
const deletePluginByIdController = container.resolve(DeletePluginByIdController);
const listPluginsController = container.resolve(ListPluginsController);
const executePluginController = container.resolve(ExecutePluginController);
const validateWorkflowController = container.resolve(ValidateWorkflowController);
const getNodeSchemasController = container.resolve(GetNodeSchemasController);
const uploadBinaryController = container.resolve(UploadBinaryController);
const deleteBinaryController = container.resolve(DeleteBinaryController);
const exportPluginController = container.resolve(ExportPluginController);
const importPluginController = container.resolve(ImportPluginController);

const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 }
});

router.use(protect);

router.get('/:teamId/schemas', getNodeSchemasController.handle);
router.post('/:teamId/validate-workflow', validateWorkflowController.handle);

router.get('/:teamId', listPluginsController.handle);
router.post('/:teamId', createPluginController.handle);

router.post('/:teamid/:pluginId/binary', upload.single('file'), uploadBinaryController.handle);
router.delete('/:teamId/:pluginId/binary', deleteBinaryController.handle);

router.get('/:teamId/:pluginId/export', exportPluginController.handle);
router.post('/:teamId/import', upload.single('file'), importPluginController.handle);

router.route('/:teamId/:pluginId')
    .get(getPluginByIdController.handle)
    .patch(updatePluginByIdController.handle)
    .delete(deletePluginByIdController.handle);

router.post('/:teamId/:pluginSlug/execute', executePluginController.handle);

export default router;
