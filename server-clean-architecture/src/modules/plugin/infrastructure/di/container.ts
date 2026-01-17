import { container } from 'tsyringe';
import { PluginListingService } from '../services/PluginListingService';
import { WorkflowValidatorService } from '../services/WorkflowValidatorService';
import { NodeRegistryService } from '../services/NodeRegistryService';
import { PLUGIN_TOKENS } from './PluginTokens';
import PluginRepository from '../persistence/mongo/repositories/PluginRepository';
import ListingRowRepository from '../persistence/mongo/repositories/ListingRowRepository';
import ExposureMetaRepository from '../persistence/mongo/repositories/ExposureMetaRepository';
import PluginWorkflowEngine from '../services/PluginWorkflowEngine';
import NodeRegistry from '../services/nodes/NodeRegistry';

import PluginStorageService from '../services/PluginStorageService';

import { CreatePluginUseCase } from '../../application/use-cases/plugin/CreatePluginUseCase';
import { GetPluginByIdUseCase } from '../../application/use-cases/plugin/GetPluginByIdUseCase';
import { UpdatePluginByIdUseCase } from '../../application/use-cases/plugin/UpdatePluginByIdUseCase';
import { DeletePluginByIdUseCase } from '../../application/use-cases/plugin/DeletePluginByIdUseCase';
import { ListPluginsUseCase } from '../../application/use-cases/plugin/ListPluginsUseCase';
import { ExecutePluginUseCase } from '../../application/use-cases/plugin/ExecutePluginUseCase';
import { ValidateWorkflowUseCase } from '../../application/use-cases/plugin/ValidateWorkflowUseCase';
import { GetNodeSchemasUseCase } from '../../application/use-cases/plugin/GetNodeSchemasUseCase';
import { ImportPluginUseCase } from '../../application/use-cases/plugin/ImportPluginUseCase';
import { ExportPluginUseCase } from '../../application/use-cases/plugin/ExportPluginUseCase';
import { DeleteBinaryUseCase } from '../../application/use-cases/plugin/DeleteBinaryUseCase';
import { UploadBinaryUseCase } from '../../application/use-cases/plugin/UploadBinaryUseCase';

export const registerPluginDependencies = (): void => {
    // Services
    container.registerSingleton('IPluginListingService', PluginListingService);
    container.registerSingleton('IWorkflowValidatorService', WorkflowValidatorService);
    container.registerSingleton('INodeRegistryService', NodeRegistryService);
    container.registerSingleton('IPluginStorageService', PluginStorageService);

    // Repositories - register with both Symbol and string tokens
    container.registerSingleton(PLUGIN_TOKENS.PluginRepository, PluginRepository);
    container.registerSingleton('IPluginRepository', PluginRepository);
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
