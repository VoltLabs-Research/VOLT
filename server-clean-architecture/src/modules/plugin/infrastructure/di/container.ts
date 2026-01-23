import { container } from 'tsyringe';
import { PluginListingService } from '@modules/plugin/infrastructure/services/PluginListingService';
import { WorkflowValidatorService } from '@modules/plugin/infrastructure/services/WorkflowValidatorService';
import { PLUGIN_TOKENS } from './PluginTokens';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/PluginRepository';
import ListingRowRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/ListingRowRepository';
import ExposureMetaRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/ExposureMetaRepository';
import PluginWorkflowEngine from '@modules/plugin/infrastructure/services/PluginWorkflowEngine';
import NodeRegistry from '@modules/plugin/infrastructure/services/nodes/NodeRegistry';

import PluginStorageService from '@modules/plugin/infrastructure/services/PluginStorageService';
import PluginBinaryCacheService from '@modules/plugin/infrastructure/services/PluginBinaryCacheService';
import ProcessExecutorService from '@modules/plugin/infrastructure/services/ProcessExecutorService';
import AnalysisProcessingQueue from '@modules/plugin/infrastructure/queues/AnalysisProcessingQueue';
import AnalysisJobFactory from '@modules/plugin/infrastructure/services/AnalysisJobFactory';

// Node Handlers
import ModifierHandler from '@modules/plugin/infrastructure/services/nodes/handlers/ModifierHandler';
import ArgumentsHandler from '@modules/plugin/infrastructure/services/nodes/handlers/ArgumentsHandler';
import ContextHandler from '@modules/plugin/infrastructure/services/nodes/handlers/ContextHandler';
import ForEachHandler from '@modules/plugin/infrastructure/services/nodes/handlers/ForEachHandler';
import EntrypointHandler from '@modules/plugin/infrastructure/services/nodes/handlers/EntrypointHandler';
import ExposureHandler from '@modules/plugin/infrastructure/services/nodes/handlers/ExposureHandler';
import SchemaHandler from '@modules/plugin/infrastructure/services/nodes/handlers/SchemaHandler';
import VisualizersHandler from '@modules/plugin/infrastructure/services/nodes/handlers/VisualizersHandler';
import ExportHandler from '@modules/plugin/infrastructure/services/nodes/handlers/ExportHandler';
import IfStatementHandler from '@modules/plugin/infrastructure/services/nodes/handlers/IfStatementHandler';

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

import { INodeRegistry, INodeHandler } from '@modules/plugin/domain/ports/INodeRegistry';

export const registerPluginDependencies = (): void => {
    // Services
    container.registerSingleton(PLUGIN_TOKENS.PluginListingService, PluginListingService);
    container.registerSingleton(PLUGIN_TOKENS.WorkflowValidatorService, WorkflowValidatorService);
    container.registerSingleton(PLUGIN_TOKENS.PluginStorageService, PluginStorageService);
    container.registerSingleton(PLUGIN_TOKENS.PluginBinaryCacheService, PluginBinaryCacheService);
    container.registerSingleton(PLUGIN_TOKENS.ProcessExecutorService, ProcessExecutorService);

    // Repositories - register with both Symbol and string tokens
    container.registerSingleton(PLUGIN_TOKENS.PluginRepository, PluginRepository);
    container.registerSingleton(PLUGIN_TOKENS.ListingRowRepository, ListingRowRepository);
    container.registerSingleton(PLUGIN_TOKENS.ExposureMetaRepository, ExposureMetaRepository);

    // Node Registry
    container.registerSingleton(PLUGIN_TOKENS.NodeRegistry, NodeRegistry);

    // Node Handlers
    container.registerSingleton(PLUGIN_TOKENS.ModifierHandler, ModifierHandler);
    container.registerSingleton(PLUGIN_TOKENS.ArgumentsHandler, ArgumentsHandler);
    container.registerSingleton(PLUGIN_TOKENS.ContextHandler, ContextHandler);
    container.registerSingleton(PLUGIN_TOKENS.ForEachHandler, ForEachHandler);
    container.registerSingleton(PLUGIN_TOKENS.EntrypointHandler, EntrypointHandler);
    container.registerSingleton(PLUGIN_TOKENS.ExposureHandler, ExposureHandler);
    container.registerSingleton(PLUGIN_TOKENS.SchemaHandler, SchemaHandler);
    container.registerSingleton(PLUGIN_TOKENS.VisualizersHandler, VisualizersHandler);
    container.registerSingleton(PLUGIN_TOKENS.ExportHandler, ExportHandler);
    container.registerSingleton(PLUGIN_TOKENS.IfStatementHandler, IfStatementHandler);

    // Workflow Engine (depends on NodeRegistry)
    container.registerSingleton(PLUGIN_TOKENS.PluginWorkflowEngine, PluginWorkflowEngine);

    // Analysis Queue Infrastructure
    container.registerSingleton(PLUGIN_TOKENS.AnalysisProcessingQueue, AnalysisProcessingQueue);
    container.registerSingleton(PLUGIN_TOKENS.AnalysisJobFactory, AnalysisJobFactory);

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

/**
 * Initialize and register all node handlers with the NodeRegistry.
 * This should be called after registerPluginDependencies() to ensure
 * all dependencies are available for injection.
 */
export const initializeNodeHandlers = (): void => {
    const nodeRegistry = container.resolve<INodeRegistry>(PLUGIN_TOKENS.NodeRegistry);

    // Resolve all handlers from the container (they get their dependencies injected)
    const handlers: INodeHandler[] = [
        container.resolve<INodeHandler>(PLUGIN_TOKENS.ModifierHandler),
        container.resolve<INodeHandler>(PLUGIN_TOKENS.ArgumentsHandler),
        container.resolve<INodeHandler>(PLUGIN_TOKENS.ContextHandler),
        container.resolve<INodeHandler>(PLUGIN_TOKENS.ForEachHandler),
        container.resolve<INodeHandler>(PLUGIN_TOKENS.EntrypointHandler),
        container.resolve<INodeHandler>(PLUGIN_TOKENS.ExposureHandler),
        container.resolve<INodeHandler>(PLUGIN_TOKENS.SchemaHandler),
        container.resolve<INodeHandler>(PLUGIN_TOKENS.VisualizersHandler),
        container.resolve<INodeHandler>(PLUGIN_TOKENS.ExportHandler),
        container.resolve<INodeHandler>(PLUGIN_TOKENS.IfStatementHandler)
    ];

    // Register all handlers with the NodeRegistry
    handlers.forEach((handler) => nodeRegistry.register(handler));

    const registeredTypes = nodeRegistry.getRegisteredTypes();
    console.log(`[NodeRegistry] Registered ${registeredTypes.length} handlers: ${registeredTypes.join(', ')}`);
};
