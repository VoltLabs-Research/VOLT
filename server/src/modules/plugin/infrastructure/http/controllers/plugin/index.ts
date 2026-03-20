import { ClonePluginUseCase } from '@modules/plugin/application/use-cases/plugin/ClonePluginUseCase';
import { CreatePluginUseCase } from '@modules/plugin/application/use-cases/plugin/CreatePluginUseCase';
import { DeleteBinaryUseCase } from '@modules/plugin/application/use-cases/plugin/DeleteBinaryUseCase';
import { DeletePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/DeletePluginByIdUseCase';
import { ExecutePluginUseCase } from '@modules/plugin/application/use-cases/plugin/ExecutePluginUseCase';
import { ExportPluginUseCase } from '@modules/plugin/application/use-cases/plugin/ExportPluginUseCase';
import { GetPluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/GetPluginByIdUseCase';
import { ImportPluginUseCase } from '@modules/plugin/application/use-cases/plugin/ImportPluginUseCase';
import { ListPluginsUseCase } from '@modules/plugin/application/use-cases/plugin/ListPluginsUseCase';
import { UpdatePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/UpdatePluginByIdUseCase';
import { UploadBinaryUseCase } from '@modules/plugin/application/use-cases/plugin/UploadBinaryUseCase';
import { ValidateWorkflowUseCase } from '@modules/plugin/application/use-cases/plugin/ValidateWorkflowUseCase';

import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import {
    createController,
    createPreparedDownloadStreamController
} from '@shared/infrastructure/http/controllers/createController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

const withAuthenticatedUserId = (
    req: AuthenticatedRequest,
    params: Record<string, unknown>
): Record<string, unknown> => ({
    ...params,
    userId: req.userId
});

const ClonePluginController = createController(ClonePluginUseCase, HttpStatus.Created);
const CreatePluginController = createController(CreatePluginUseCase, HttpStatus.Created);
const DeleteBinaryController = createController(DeleteBinaryUseCase, HttpStatus.NoContent);
const DeletePluginByIdController = createController(DeletePluginByIdUseCase, HttpStatus.NoContent);
const ExecutePluginController = createController(ExecutePluginUseCase, {
    extendParams: withAuthenticatedUserId
});
const ExportPluginController = createPreparedDownloadStreamController(ExportPluginUseCase);
const GetPluginByIdController = createController(GetPluginByIdUseCase);
const ImportPluginController = createController(ImportPluginUseCase, HttpStatus.Created);
const ListPluginsController = createController(ListPluginsUseCase);
const UpdatePluginByIdController = createController(UpdatePluginByIdUseCase);
const UploadBinaryController = createController(UploadBinaryUseCase);
const ValidateWorkflowController = createController(ValidateWorkflowUseCase);

export default createControllerRegistry({
    clone: ClonePluginController,
    create: CreatePluginController,
    deleteBinary: DeleteBinaryController,
    deleteById: DeletePluginByIdController,
    executePlugin: ExecutePluginController,
    exportPlugin: ExportPluginController,
    getPluginById: GetPluginByIdController,
    importPlugin: ImportPluginController,
    listPlugins: ListPluginsController,
    updatePluginById: UpdatePluginByIdController,
    uploadBinary: UploadBinaryController,
    validateWorkflow: ValidateWorkflowController
});
