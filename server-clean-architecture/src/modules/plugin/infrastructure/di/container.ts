import { container } from 'tsyringe';
import { PluginListingService } from '@modules/plugin/infrastructure/services/PluginListingService';
import { WorkflowValidatorService } from '@modules/plugin/infrastructure/services/WorkflowValidatorService';
import { NodeRegistryService } from '@modules/plugin/infrastructure/services/NodeRegistryService';
import { PLUGIN_TOKENS } from './PluginTokens';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/PluginRepository';
import ListingRowRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/ListingRowRepository';
import ExposureMetaRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/ExposureMetaRepository';
import PluginWorkflowEngine from '@modules/plugin/infrastructure/services/PluginWorkflowEngine';
import NodeRegistry from '@modules/plugin/infrastructure/services/nodes/NodeRegistry';

import PluginStorageService from '@modules/plugin/infrastructure/services/PluginStorageService';

import { CreatePluginUseCase } from '@modules/plugin/application/use-cases/plugin/CreatePluginUseCase';
import { GetPluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/GetPluginByIdUseCase';
import { UpdatePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/UpdatePluginByIdUseCase';
import { DeletePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/DeletePluginByIdUseCase';
import { ListPluginsUseCase } from '@modules/plugin/application/use-cases/plugin/ListPluginsUseCase';
import { ExecutePluginUseCase } from '@modules/plugin/application/use-cases/plugin/ExecutePluginUseCase';
import { ValidateWorkflowUseCase } from '@modules/plugin/application/use-cases/plugin/ValidateWorkflowUseCase';
import { GetNodeSchemasUseCase } from '@modules/plugin/application/use-cases/plugin/GetNodeSchemasUseCase';
import { ImportPluginUseCase } from '@modules/plugin/application/use-cases/plugin/ImportPluginUseCase';
import { ExportPluginUseCase } from '@modules/plugin/application/use-cases/plugin/ExportPluginUseCase';
import { DeleteBinaryUseCase } from '@modules/plugin/application/use-cases/plugin/DeleteBinaryUseCase';
import { UploadBinaryUseCase } from '@modules/plugin/application/use-cases/plugin/UploadBinaryUseCase';

export const registerPluginDependencies = (): void => {
    // Services
    container.registerSingleton(PLUGIN_TOKENS.PluginListingService, PluginListingService);
    container.registerSingleton(PLUGIN_TOKENS.WorkflowValidatorService, WorkflowValidatorService);
    container.registerSingleton(PLUGIN_TOKENS.NodeRegistry, NodeRegistryService);
    container.registerSingleton(PLUGIN_TOKENS.PluginStorageService, PluginStorageService);

    // Repositories - register with both Symbol and string tokens
    container.registerSingleton(PLUGIN_TOKENS.PluginRepository, PluginRepository);
    container.registerSingleton(PLUGIN_TOKENS.ListingRowRepository, ListingRowRepository);
    container.registerSingleton(PLUGIN_TOKENS.ExposureMetaRepository, ExposureMetaRepository);

    // Workflow Engine & Node Registry
    container.registerSingleton(PLUGIN_TOKENS.NodeRegistry, NodeRegistry);
    container.registerSingleton(PLUGIN_TOKENS.PluginWorkflowEngine, PluginWorkflowEngine);

    // Use Cases
    container.registerSingleton(CreatePluginUseCase);
    container.registerSingleton(GetPluginByIdUseCase);
    container.registerSingleton(UpdatePluginByIdUseCase);
    container.registerSingleton(DeletePluginByIdUseCase);
    container.registerSingleton(ListPluginsUseCase);
    container.registerSingleton(ExecutePluginUseCase);
    container.registerSingleton(ValidateWorkflowUseCase);
    container.registerSingleton(GetNodeSchemasUseCase);
    container.registerSingleton(ImportPluginUseCase);
    container.registerSingleton(ExportPluginUseCase);
    container.registerSingleton(DeleteBinaryUseCase);
    container.registerSingleton(UploadBinaryUseCase);
};
