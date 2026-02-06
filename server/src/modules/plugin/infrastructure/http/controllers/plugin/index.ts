import CreatePluginController from './CreatePluginController';
import DeleteBinaryController from './DeleteBinaryController';
import DeletePluginByIdController from './DeletePluginByIdController';
import ExecutePluginController from './ExecutePluginController';
import ExportPluginController from './ExportPluginController';
import GetNodeSchemasController from './GetNodeSchemasController';
import GetPluginByIdController from './GetPluginByIdController';
import ImportPluginController from './ImportPluginController';
import ListPluginsController from './ListPluginsController';
import UpdatePluginByIdController from './UpdatePluginByIdController';
import UploadBinaryController from './UploadBinaryController';
import ValidateWorkflowController from './ValidateWorkflowController';
import { container } from 'tsyringe';

export default {
    create: container.resolve(CreatePluginController),
    deleteBinary: container.resolve(DeleteBinaryController),
    deleteById: container.resolve(DeletePluginByIdController),
    executePlugin: container.resolve(ExecutePluginController),
    exportPlugin: container.resolve(ExportPluginController),
    getNodeSchemas: container.resolve(GetNodeSchemasController),
    getPluginById: container.resolve(GetPluginByIdController),
    importPlugin: container.resolve(ImportPluginController),
    listPlugins: container.resolve(ListPluginsController),
    updatePluginById: container.resolve(UpdatePluginByIdController),
    uploadBinary: container.resolve(UploadBinaryController),
    validateWorkflow: container.resolve(ValidateWorkflowController)
};