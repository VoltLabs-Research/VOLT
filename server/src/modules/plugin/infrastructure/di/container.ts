import * as pluginAiTools from '@modules/plugin/application/ai-tools';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { GetPluginExposureExportUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureExportUseCase';
import { GetPluginExposureGLBUseCase } from '@modules/plugin/application/use-cases/exposure/GetPluginExposureGLBUseCase';
import { ExportListingRowsByAnalysisIdUseCase } from '@modules/plugin/application/use-cases/listing-row/ExportListingRowsByAnalysisIdUseCase';
import { ExportPluginListingDocumentsUseCase } from '@modules/plugin/application/use-cases/listing-row/ExportPluginListingDocumentsUseCase';
import { GetAnalysisListingExportOptionsUseCase } from '@modules/plugin/application/use-cases/listing-row/GetAnalysisListingExportOptionsUseCase';
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
import { ListingRowsExportPresenter } from '@modules/plugin/infrastructure/http/presenters/listing-row/ListingRowsExportPresenter';
import { DefaultPluginBootstrapService } from '@modules/plugin/infrastructure/services/plugin/DefaultPluginBootstrapService';
import { PluginExposureExportService } from '@modules/plugin/infrastructure/services/exposure/PluginExposureExportService';
import { DaemonPluginListingService } from '@modules/plugin/infrastructure/services/listing-row/DaemonPluginListingService';
import { AnalysisListingExportCatalogService } from '@modules/plugin/application/services/listing-row/AnalysisListingExportCatalogService';
import { WorkflowValidatorService } from '@modules/plugin/infrastructure/services/plugin/WorkflowValidatorService';
import { PluginDependencyResolverService } from '@modules/plugin/infrastructure/services/plugin/PluginDependencyResolverService';
import PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import PluginBinaryCacheService from '@modules/plugin/infrastructure/services/plugin/PluginBinaryCacheService';
import PluginExecutionRouter from '@modules/plugin/infrastructure/services/plugin/PluginExecutionRouter';
import PluginStorageService from '@modules/plugin/infrastructure/services/plugin/PluginStorageService';
import PluginDebugSocketModule from '@modules/plugin/infrastructure/socket/PluginDebugSocketModule';

import { AI_TOKENS } from '@modules/ai/infrastructure/di/AITokens';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { createClassBindings, registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';

export const registerPluginDependencies = (): void => {
    registerModuleDependencies({
        singletons: [
            [PLUGIN_TOKENS.PluginListingService, DaemonPluginListingService],
            [PLUGIN_TOKENS.WorkflowValidatorService, WorkflowValidatorService],
            [PLUGIN_TOKENS.PluginDependencyResolverService, PluginDependencyResolverService],
            [PLUGIN_TOKENS.PluginStorageService, PluginStorageService],
            [PLUGIN_TOKENS.DefaultPluginBootstrapService, DefaultPluginBootstrapService],
            [PLUGIN_TOKENS.PluginBinaryCacheService, PluginBinaryCacheService],
            [PLUGIN_TOKENS.PluginExecutionRouter, PluginExecutionRouter],
            AnalysisListingExportCatalogService,
            [PLUGIN_TOKENS.ListingRowsExportPresenter, ListingRowsExportPresenter],
            [PLUGIN_TOKENS.PluginExposureExportService, PluginExposureExportService],
            [PLUGIN_TOKENS.PluginRepository, PluginRepository],
            [PLUGIN_TOKENS.PluginDebugSocketModule, PluginDebugSocketModule],
            CreatePluginUseCase,
            GetPluginByIdUseCase,
            UpdatePluginByIdUseCase,
            DeletePluginByIdUseCase,
            ListPluginsUseCase,
            ExecutePluginUseCase,
            ValidateWorkflowUseCase,
            ImportPluginUseCase,
            ExportPluginUseCase,
            DeleteBinaryUseCase,
            UploadBinaryUseCase,
            ExportPluginListingDocumentsUseCase,
            ExportListingRowsByAnalysisIdUseCase,
            GetAnalysisListingExportOptionsUseCase,
            GetPluginExposureGLBUseCase,
            GetPluginExposureExportUseCase
        ],
        aliases: [
            [SOCKET_TOKENS.SocketModule, PLUGIN_TOKENS.PluginDebugSocketModule]
        ],
        bindings: [
            ...createClassBindings(AI_TOKENS.AITool, pluginAiTools)
        ]
    });
};
