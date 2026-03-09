import * as pluginAiTools from '@modules/plugin/application/ai-tools';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { GetPluginExposureExportUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureExportUseCase';
import { GetPluginExposureGLBUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureGLBUseCase';
import { ExportListingRowsByAnalysisIdUseCase } from '@modules/plugin/application/use-cases/listing-row/ExportListingRowsByAnalysisIdUseCase';
import { ExportPluginListingDocumentsUseCase } from '@modules/plugin/application/use-cases/listing-row/ExportPluginListingDocumentsUseCase';
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
import { INodeRegistry, INodeHandler } from '@modules/plugin/domain/port/plugin/INodeRegistry';
import { ListingRowsExportPresenter } from '@modules/plugin/infrastructure/http/presenters/listing-row/ListingRowsExportPresenter';
import { DefaultPluginBootstrapService } from '@modules/plugin/infrastructure/services/plugin/DefaultPluginBootstrapService';
import { ListingRowPrecomputationService } from '@modules/plugin/infrastructure/services/listing-row/ListingRowPrecomputationService';
import { PluginExposureExportService } from '@modules/plugin/infrastructure/services/exposure/PluginExposureExportService';
import { PluginListingService } from '@modules/plugin/infrastructure/services/listing-row/PluginListingService';
import { WorkflowValidatorService } from '@modules/plugin/infrastructure/services/plugin/WorkflowValidatorService';
import { DebugSocketOrchestrator } from '@modules/plugin/socket/debug/DebugSocketOrchestrator';
import ListingRowRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/listing-row/ListingRowRepository';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import SubListingRowRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/listing-row/SubListingRowRepository';
import AnalysisProcessingQueue from '@modules/plugin/queues/AnalysisProcessingQueue';
import AnalysisJobFactory from '@modules/plugin/infrastructure/services/plugin/AnalysisJobFactory';
import ArgumentsHandler from '@modules/plugin/infrastructure/services/plugin/nodes/handlers/ArgumentsHandler';
import ContextHandler from '@modules/plugin/infrastructure/services/plugin/nodes/handlers/ContextHandler';
import EntrypointHandler from '@modules/plugin/infrastructure/services/plugin/nodes/handlers/EntrypointHandler';
import ExportHandler from '@modules/plugin/infrastructure/services/plugin/nodes/handlers/ExportHandler';
import ExposureHandler from '@modules/plugin/infrastructure/services/plugin/nodes/handlers/ExposureHandler';
import ForEachHandler from '@modules/plugin/infrastructure/services/plugin/nodes/handlers/ForEachHandler';
import IfStatementHandler from '@modules/plugin/infrastructure/services/plugin/nodes/handlers/IfStatementHandler';
import ModifierHandler from '@modules/plugin/infrastructure/services/plugin/nodes/handlers/ModifierHandler';
import NodeRegistry from '@modules/plugin/infrastructure/services/plugin/nodes/NodeRegistry';
import PluginBinaryCacheService from '@modules/plugin/infrastructure/services/plugin/PluginBinaryCacheService';
import PluginExecutionRouter from '@modules/plugin/infrastructure/services/plugin/PluginExecutionRouter';
import PluginStorageService from '@modules/plugin/infrastructure/services/plugin/PluginStorageService';
import PluginWorkflowEngine from '@modules/plugin/infrastructure/services/plugin/PluginWorkflowEngine';
import ProcessExecutorService from '@modules/plugin/infrastructure/services/plugin/ProcessExecutorService';
import DebugSocketModule from '@modules/plugin/socket/DebugSocketModule';

import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import type { ClassProvider } from 'tsyringe';
import { container } from 'tsyringe';

const PLUGIN_AI_TOOL_CLASSES: ClassProvider<unknown>[] = Object.values(pluginAiTools).map((useClass) => ({ useClass }));

export const registerPluginDependencies = (): void => {
    container.registerSingleton(PLUGIN_TOKENS.PluginListingService, PluginListingService);
    container.registerSingleton(PLUGIN_TOKENS.WorkflowValidatorService, WorkflowValidatorService);
    container.registerSingleton(PLUGIN_TOKENS.ListingRowPrecomputationService, ListingRowPrecomputationService);
    container.registerSingleton(PLUGIN_TOKENS.PluginStorageService, PluginStorageService);
    container.registerSingleton(PLUGIN_TOKENS.DefaultPluginBootstrapService, DefaultPluginBootstrapService);
    container.registerSingleton(PLUGIN_TOKENS.PluginBinaryCacheService, PluginBinaryCacheService);
    container.registerSingleton(PLUGIN_TOKENS.PluginExecutionRouter, PluginExecutionRouter);
    container.registerSingleton(PLUGIN_TOKENS.ListingRowsExportPresenter, ListingRowsExportPresenter);
    container.registerSingleton(PLUGIN_TOKENS.PluginExposureExportService, PluginExposureExportService);
    container.registerSingleton(PLUGIN_TOKENS.ProcessExecutorService, ProcessExecutorService);

    container.registerSingleton(PLUGIN_TOKENS.PluginRepository, PluginRepository);
    container.registerSingleton(PLUGIN_TOKENS.ListingRowRepository, ListingRowRepository);
    container.registerSingleton(PLUGIN_TOKENS.SubListingRowRepository, SubListingRowRepository);

    container.registerSingleton(PLUGIN_TOKENS.NodeRegistry, NodeRegistry);

    container.registerSingleton(PLUGIN_TOKENS.ModifierHandler, ModifierHandler);
    container.registerSingleton(PLUGIN_TOKENS.ArgumentsHandler, ArgumentsHandler);
    container.registerSingleton(PLUGIN_TOKENS.ContextHandler, ContextHandler);
    container.registerSingleton(PLUGIN_TOKENS.ForEachHandler, ForEachHandler);
    container.registerSingleton(PLUGIN_TOKENS.EntrypointHandler, EntrypointHandler);
    container.registerSingleton(PLUGIN_TOKENS.ExposureHandler, ExposureHandler);
    container.registerSingleton(PLUGIN_TOKENS.ExportHandler, ExportHandler);
    container.registerSingleton(PLUGIN_TOKENS.IfStatementHandler, IfStatementHandler);

    container.registerSingleton(PLUGIN_TOKENS.PluginWorkflowEngine, PluginWorkflowEngine);

    container.registerSingleton(PLUGIN_TOKENS.AnalysisProcessingQueue, AnalysisProcessingQueue);
    container.registerSingleton(PLUGIN_TOKENS.AnalysisJobFactory, AnalysisJobFactory);
    container.registerSingleton(DebugSocketOrchestrator);
    container.registerSingleton(PLUGIN_TOKENS.DebugSocketModule, DebugSocketModule);
    container.register(SOCKET_TOKENS.SocketModule, { useToken: PLUGIN_TOKENS.DebugSocketModule });

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
    container.registerSingleton(ExportPluginListingDocumentsUseCase);
    container.registerSingleton(ExportListingRowsByAnalysisIdUseCase);
    container.registerSingleton(GetPluginExposureGLBUseCase);
    container.registerSingleton(GetPluginExposureExportUseCase);

    for (const toolClassProvider of PLUGIN_AI_TOOL_CLASSES) {
        container.register(AI_TOKENS.AITool, toolClassProvider);
    }
};

export const initializeNodeHandlers = (): void => {
    const nodeRegistry = container.resolve<INodeRegistry>(PLUGIN_TOKENS.NodeRegistry);

    const handlers: INodeHandler[] = [
        container.resolve<INodeHandler>(PLUGIN_TOKENS.ModifierHandler),
        container.resolve<INodeHandler>(PLUGIN_TOKENS.ArgumentsHandler),
        container.resolve<INodeHandler>(PLUGIN_TOKENS.ContextHandler),
        container.resolve<INodeHandler>(PLUGIN_TOKENS.ForEachHandler),
        container.resolve<INodeHandler>(PLUGIN_TOKENS.EntrypointHandler),
        container.resolve<INodeHandler>(PLUGIN_TOKENS.ExposureHandler),
        container.resolve<INodeHandler>(PLUGIN_TOKENS.ExportHandler),
        container.resolve<INodeHandler>(PLUGIN_TOKENS.IfStatementHandler)
    ];

    handlers.forEach((handler) => {
        if (!nodeRegistry.has(handler.type)) {
            nodeRegistry.register(handler);
        }
    });
};
