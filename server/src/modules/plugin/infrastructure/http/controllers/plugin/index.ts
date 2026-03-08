import { container } from 'tsyringe';
import { createController, createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { ClonePluginUseCase } from '@modules/plugin/application/use-cases/plugin/ClonePluginUseCase';
import { CreatePluginUseCase } from '@modules/plugin/application/use-cases/plugin/CreatePluginUseCase';
import { DeleteBinaryUseCase } from '@modules/plugin/application/use-cases/plugin/DeleteBinaryUseCase';
import { DeletePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/DeletePluginByIdUseCase';
import { ExecutePluginUseCase } from '@modules/plugin/application/use-cases/plugin/ExecutePluginUseCase';
import { ExportPluginUseCase } from '@modules/plugin/application/use-cases/plugin/ExportPluginUseCase';
import { GetNodeSchemasUseCase } from '@modules/plugin/application/use-cases/plugin/GetNodeSchemasUseCase';
import { GetPluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/GetPluginByIdUseCase';
import { ImportPluginUseCase } from '@modules/plugin/application/use-cases/plugin/ImportPluginUseCase';
import { ListPluginsUseCase } from '@modules/plugin/application/use-cases/plugin/ListPluginsUseCase';
import { UpdatePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/UpdatePluginByIdUseCase';
import { UploadBinaryUseCase } from '@modules/plugin/application/use-cases/plugin/UploadBinaryUseCase';
import { ValidateWorkflowUseCase } from '@modules/plugin/application/use-cases/plugin/ValidateWorkflowUseCase';

const ClonePluginController = createController(ClonePluginUseCase, HttpStatus.Created);
const CreatePluginController = createController(CreatePluginUseCase);
const DeleteBinaryController = createController(DeleteBinaryUseCase);
const DeletePluginByIdController = createController(DeletePluginByIdUseCase);
const ExecutePluginController = createController(ExecutePluginUseCase);
const ExportPluginController = createStreamController(ExportPluginUseCase, {
    getHeaders: (resultValue) => resultValue.headers,
    prepareOutput: async (resultValue) => {
        await resultValue.prepare?.();
    }
});
const GetNodeSchemasController = createController(GetNodeSchemasUseCase);
const GetPluginByIdController = createController(GetPluginByIdUseCase);
const ImportPluginController = createController(ImportPluginUseCase);
const ListPluginsController = createController(ListPluginsUseCase);
const UpdatePluginByIdController = createController(UpdatePluginByIdUseCase);
const UploadBinaryController = createController(UploadBinaryUseCase);
const ValidateWorkflowController = createController(ValidateWorkflowUseCase);

export default {
    clone: container.resolve(ClonePluginController),
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
