import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { PLUGIN_TOKENS } from '../../infrastructure/di/tokens';
import type GetPluginsUseCase from '../../application/use-cases/GetPluginsUseCase';
import type GetPluginUseCase from '../../application/use-cases/GetPluginUseCase';
import type CreatePluginUseCase from '../../application/use-cases/CreatePluginUseCase';
import type ClonePluginUseCase from '../../application/use-cases/ClonePluginUseCase';
import type UpdatePluginUseCase from '../../application/use-cases/UpdatePluginUseCase';
import type DeletePluginUseCase from '../../application/use-cases/DeletePluginUseCase';
import type ExecutePluginUseCase from '../../application/use-cases/ExecutePluginUseCase';
import type ExportPluginUseCase from '../../application/use-cases/ExportPluginUseCase';
import type ImportPluginUseCase from '../../application/use-cases/ImportPluginUseCase';
import type UploadBinaryUseCase from '../../application/use-cases/UploadBinaryUseCase';
import type DeleteBinaryUseCase from '../../application/use-cases/DeleteBinaryUseCase';
import type GetPluginListingUseCase from '../../application/use-cases/GetPluginListingUseCase';

const usePluginUseCases = createUseCasesHook({
    getPluginsUseCase: PLUGIN_TOKENS.GetPluginsUseCase,
    getPluginUseCase: PLUGIN_TOKENS.GetPluginUseCase,
    createPluginUseCase: PLUGIN_TOKENS.CreatePluginUseCase,
    clonePluginUseCase: PLUGIN_TOKENS.ClonePluginUseCase,
    updatePluginUseCase: PLUGIN_TOKENS.UpdatePluginUseCase,
    deletePluginUseCase: PLUGIN_TOKENS.DeletePluginUseCase,
    executePluginUseCase: PLUGIN_TOKENS.ExecutePluginUseCase,
    exportPluginUseCase: PLUGIN_TOKENS.ExportPluginUseCase,
    importPluginUseCase: PLUGIN_TOKENS.ImportPluginUseCase,
    uploadBinaryUseCase: PLUGIN_TOKENS.UploadBinaryUseCase,
    deleteBinaryUseCase: PLUGIN_TOKENS.DeleteBinaryUseCase,
    getPluginListingUseCase: PLUGIN_TOKENS.GetPluginListingUseCase
}) as () => {
    getPluginsUseCase: GetPluginsUseCase;
    getPluginUseCase: GetPluginUseCase;
    createPluginUseCase: CreatePluginUseCase;
    clonePluginUseCase: ClonePluginUseCase;
    updatePluginUseCase: UpdatePluginUseCase;
    deletePluginUseCase: DeletePluginUseCase;
    executePluginUseCase: ExecutePluginUseCase;
    exportPluginUseCase: ExportPluginUseCase;
    importPluginUseCase: ImportPluginUseCase;
    uploadBinaryUseCase: UploadBinaryUseCase;
    deleteBinaryUseCase: DeleteBinaryUseCase;
    getPluginListingUseCase: GetPluginListingUseCase;
};

export default usePluginUseCases;
