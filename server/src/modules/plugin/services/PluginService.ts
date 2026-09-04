import { ErrorCodes } from '@core/constants/error-codes';
import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import ClusterObjectArchiveService from '@modules/cluster/services/object-store/ClusterObjectArchiveService';
import ClusterObjectSignedUrlService from '@modules/cluster/services/object-store/ClusterObjectSignedUrlService';
import storagePlacementService from '@modules/cluster/services/storage/StoragePlacementService';
import objectGatewayClient from '@modules/cluster/services/object-gateway/TeamClusterObjectGatewayClient';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import { findTeamClusterByIdWithSensitiveData } from '@modules/cluster/contracts/team-cluster';

import type { PluginRecord } from '@modules/plugin/contracts/plugin';
import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import {
    WorkflowNodeType,
    type WorkflowNode
} from '@modules/plugin/models/plugin/workflow/WorkflowTypes';
import { mapPluginToRecord } from '@modules/plugin/services/plugin/PluginQueries';
import PluginArchiveService from '@modules/plugin/services/plugin/PluginArchiveService';
import PluginBinaryStorageService from '@modules/plugin/services/plugin/PluginBinaryStorageService';
import PluginCrudService, {
    type ListPluginsInput,
    type UpdatePluginByIdInput
} from '@modules/plugin/services/plugin/PluginCrudService';
import PipelineExecutionPlanner, {
    type ExecutePipelineInput,
    type PipelineStageInput
} from '@modules/plugin/services/plugin/PipelineExecutionPlanner';
import {
    getPipelineRunsByTrajectoryId,
    type GetPipelineRunsByTrajectoryIdInput
} from '@modules/plugin/services/plugin/PipelineRunQueries';
import {
    deletePipelineRun,
    updatePipelineRun,
    type DeletePipelineRunInput,
    type UpdatePipelineRunInput
} from '@modules/plugin/services/plugin/PipelineRunCommands';
import PluginExposureArtifactService, {
    type GetPluginExposureChartInput,
    type GetPluginExposurePanelsInput
} from '@modules/plugin/services/exposure/PluginExposureArtifactService';
import type { GetPluginExposurePanelsResponse } from '@volt/contracts/modules/plugin/panel';

import { PluginExposureExportService } from '@modules/plugin/services/exposure/PluginExposureExportService';
import { PluginDependencyResolverService } from '@modules/plugin/services/plugin/PluginDependencyResolverService';
import {
    WorkflowValidationMode,
    WorkflowValidatorService
} from '@modules/plugin/services/plugin/WorkflowValidatorService';
import RegistryGateway, { type RegistrySearchResult } from '@modules/plugin/services/plugin/RegistryGateway';

import { AnalysisListingExportCatalogService } from '@modules/plugin/services/listing-row/AnalysisListingExportCatalogService';
import { ListingRowsExportService } from '@modules/plugin/services/listing-row/ListingRowsExportService';
import PluginListingQueryService from '@modules/plugin/services/listing-row/PluginListingQueryService';
import type {
    ExportListingRowsByAnalysisIdInput,
    GetAnalysisListingExportOptionsInput,
    GetAnalysisListingExportOptionsOutput,
    GetListingRowsByAnalysisIdInput,
    GetListingRowsByAnalysisIdOutput
} from '@modules/plugin/services/listing-row/ListingRowTypes';

import ApplicationError from '@shared/application/errors/ApplicationError';
import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import {
    ChannelCommands,
    type TeamClusterDaemonRegistryInstallResult
} from '@shared/contracts/types/team-cluster-daemon-channel';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import type { DownloadStreamOutput } from '@shared/contracts/types/DownloadStream';
import type { GetPluginByIdInput } from '@shared/contracts/operations/GetPluginById';
import type { GetPluginExposureExportInput } from '@shared/contracts/operations/GetPluginExposureExport';
import type {
    GetPluginExposureGLBInput,
    GetPluginExposureGLBOutput
} from '@shared/contracts/operations/GetPluginExposureGLB';
import type {
    ExportPluginListingDocumentsInput,
    GetPluginListingDocumentsInput,
    GetPluginListingDocumentsOutput
} from '@shared/contracts/operations/GetPluginListingDocuments';
import type { GetSubListingInput, GetSubListingOutput } from '@shared/contracts/operations/GetSubListing';
import type {
    CommitBinaryUploadInput as WireCommitBinaryUploadInput,
    UploadBinaryInput as WireUploadBinaryInput
} from '@volt/contracts/modules/plugin/http';
import type { PipelineRun } from '@volt/contracts/modules/plugin/pipeline-run';
import type {
    BinaryUploadResult,
    BinaryUploadTarget,
    ExecutePipelineResponse
} from '@volt/contracts/modules/plugin/plugin';

export type {
    ExecutePipelineInput,
    GetPluginExposureChartInput,
    ListPluginsInput,
    PipelineStageInput,
    UpdatePluginByIdInput
};

export interface PluginIdInput {
    pluginId: string;
}

export interface ClonePluginInput extends PluginIdInput {
    teamId: string;
}

export interface CreatePluginInput {
    workflow: WorkflowProps;
    teamId: string;
}

export interface DownloadPluginBinaryInput extends PluginIdInput {
    teamId: string;
}

export interface ImportPluginInput {
    file: { buffer: Buffer };
    teamId: string;
}

export interface RegistryInstallPluginInput {
    teamId: string;
    name: string;
    version?: string;
}

export interface SearchRegistryPluginsInput {
    teamId: string;
    q?: string;
    page?: number;
    limit?: number;
}

export interface UploadBinaryInput extends WireUploadBinaryInput, PluginIdInput {
    teamId: string;
    userId: string;
}

export interface CommitBinaryUploadInput extends WireCommitBinaryUploadInput, PluginIdInput {
    teamId: string;
    userId: string;
}

export interface ValidateWorkflowInput {
    workflow: WorkflowProps;
    pluginId?: string;
}

interface ValidateWorkflowOutput {
    validated: boolean;
    errors?: string[];
    modifier?: WorkflowNode;
}

const DEFAULT_REGISTRY_INSTALL_PLATFORM = 'linux-x86_64';

const resolveRegistryInstallPlatform = async (teamClusterId: string): Promise<string> => {
    const teamCluster = await findTeamClusterByIdWithSensitiveData(teamClusterId);
    return teamCluster?.props.hostCapabilities?.platform ?? DEFAULT_REGISTRY_INSTALL_PLATFORM;
};

const NODE_OUTPUT_PROPERTIES: Record<string, string[]> = {
    [WorkflowNodeType.Modifier]: ['pluginId', 'trajectory', 'analysis'],
    [WorkflowNodeType.Arguments]: ['as_str', 'as_array', 'selectedTimesteps'],
    [WorkflowNodeType.Context]: ['trajectory_dumps', 'count', 'trajectory'],
    [WorkflowNodeType.ForEach]: ['items', 'count', 'currentValue', 'currentValue.path', 'currentValue.frame', 'currentIndex', 'outputPath'],
    [WorkflowNodeType.Entrypoint]: ['results', 'successCount', 'failCount', 'stdout', 'stderr', 'exitCode', 'projectPath'],
    [WorkflowNodeType.Plugin]: ['execution_result', 'execution_result.exposures', 'execution_result.exposures.items', 'execution_result.exposures.str_json'],
    [WorkflowNodeType.Exposure]: ['results', 'sample'],
    [WorkflowNodeType.Export]: ['results'],
    [WorkflowNodeType.IfStatement]: ['result', 'branch'],
    [WorkflowNodeType.SwitchStatement]: ['expression', 'resolvedValue', 'matchedCaseId', 'matchedValue'],
    [WorkflowNodeType.SwitchCase]: ['value', 'defaultCase']
};

export default class PluginService {
    #workflowValidator = new WorkflowValidatorService(new PluginDependencyResolverService());

    #crudService = new PluginCrudService(this.#workflowValidator);
    #pipelinePlanner = new PipelineExecutionPlanner();

    #binaryStorageService = new PluginBinaryStorageService(
        storagePlacementService,
        objectGatewayClient,
        new ClusterObjectSignedUrlService()
    );
    #archiveService = new PluginArchiveService(
        storagePlacementService,
        objectGatewayClient,
        this.#workflowValidator,
        new ClusterObjectArchiveService()
    );
    #exposureArtifactService = new PluginExposureArtifactService(
        objectGatewayClient,
        new PluginExposureExportService(objectGatewayClient, new ClusterObjectArchiveService())
    );
    #listingQueryService = new PluginListingQueryService(teamClusterDaemonClient);
    #listingExportCatalogService = new AnalysisListingExportCatalogService(teamClusterDaemonClient);
    #listingRowsExportService = new ListingRowsExportService(new ClusterObjectArchiveService());
    #registryGateway = new RegistryGateway();

    async getNodeTypesSchema(): Promise<{ nodeTypes: Record<string, string[]> }> {
        return { nodeTypes: NODE_OUTPUT_PROPERTIES };
    }

    async validateWorkflow(input: ValidateWorkflowInput): Promise<ValidateWorkflowOutput> {
        const validation = await this.#workflowValidator.validate(
            input.workflow,
            input.pluginId,
            WorkflowValidationMode.Strict
        );

        return {
            validated: validation.isValid,
            errors: validation.errors,
            modifier: validation.modifier
        };
    }

    async exportPlugin(input: PluginIdInput): Promise<DownloadStreamOutput> {
        return createDownloadStreamResponse({
            stream: await this.#archiveService.exportPlugin(input.pluginId),
            contentType: 'application/zip',
            filename: `${input.pluginId}.zip`
        });
    }

    async importPlugin(input: ImportPluginInput): Promise<PluginRecord> {
        const plugin = await this.#archiveService.importPlugin(input.file.buffer, input.teamId);

        await eventBus.emit('plugin.created', {
            pluginId: plugin._id,
            teamId: input.teamId
        });

        return mapPluginToRecord(plugin);
    }

    async searchRegistry(input: SearchRegistryPluginsInput): Promise<RegistrySearchResult> {
        return this.#registryGateway.search(input.q ?? '', input.page ?? 1, input.limit ?? 20);
    }

    async installRegistry(input: RegistryInstallPluginInput): Promise<PluginRecord> {
        if (!input.name) {
            throw ApplicationError.badRequest(ErrorCodes.REGISTRY_PACKAGE_NAME_REQUIRED, 'A registry package name is required');
        }

        const computeClusterId = await teamClusterSelectionService.resolveComputeClusterId(input.teamId);
        const platform = await resolveRegistryInstallPlatform(computeClusterId);
        const tarball = await this.#registryGateway.resolveTarball(input.name, input.version, platform);

        const installed = await teamClusterDaemonClient.command<TeamClusterDaemonRegistryInstallResult>(
            computeClusterId,
            ChannelCommands.PluginRegistryInstall,
            {
                downloadUrl: tarball.downloadUrl,
                sha256: tarball.sha256,
                fileName: tarball.fileName,
                name: input.name,
                version: tarball.version,
                platform
            },
            {
                timeoutClass: 'long-running-control-plane',
                retryClass: 'idempotent-command'
            }
        );

        const plugin = await this.#archiveService.createFromRegistry(
            installed.workflow,
            installed.binary,
            installed.ownerClusterId,
            input.teamId
        );

        await eventBus.emit('plugin.created', {
            pluginId: plugin._id,
            teamId: input.teamId
        });

        return mapPluginToRecord(plugin);
    }

    async listPlugins(input: ListPluginsInput): Promise<PaginatedResult<PluginRecord>> {
        return this.#crudService.listPlugins(input);
    }

    async createPlugin(input: CreatePluginInput): Promise<{ plugin: PluginRecord }> {
        return this.#crudService.createPlugin(input.workflow, input.teamId);
    }

    async clonePlugin(input: ClonePluginInput): Promise<{ plugin: PluginRecord }> {
        return this.#crudService.clonePlugin(input.pluginId, input.teamId);
    }

    async getPluginById(input: GetPluginByIdInput): Promise<PluginRecord> {
        return this.#crudService.getPluginById(input.pluginId);
    }

    async updatePluginById(input: UpdatePluginByIdInput): Promise<PluginRecord> {
        return this.#crudService.updatePluginById(input);
    }

    async deletePluginById(input: PluginIdInput): Promise<null> {
        return this.#crudService.deletePluginById(input.pluginId);
    }

    async uploadBinary(input: UploadBinaryInput): Promise<BinaryUploadTarget> {
        return this.#binaryStorageService.createUploadTarget(input);
    }

    async commitBinaryUpload(input: CommitBinaryUploadInput): Promise<BinaryUploadResult> {
        return this.#binaryStorageService.commitUpload(input);
    }

    async downloadBinary(input: DownloadPluginBinaryInput): Promise<DownloadStreamOutput> {
        return this.#binaryStorageService.downloadBinary(input.pluginId, input.teamId);
    }

    async deleteBinary(input: PluginIdInput): Promise<null> {
        await this.#binaryStorageService.deleteBinary(input.pluginId);
        return null;
    }

    async executePipeline(input: ExecutePipelineInput): Promise<ExecutePipelineResponse> {
        return this.#pipelinePlanner.executePipeline(input);
    }

    async getPipelineRunsByTrajectoryId(
        input: GetPipelineRunsByTrajectoryIdInput
    ): Promise<PaginatedResult<PipelineRun>> {
        return getPipelineRunsByTrajectoryId(input);
    }

    async updatePipelineRun(input: UpdatePipelineRunInput): Promise<PipelineRun> {
        return updatePipelineRun(input);
    }

    async deletePipelineRun(input: DeletePipelineRunInput): Promise<{ success: boolean }> {
        return deletePipelineRun(input);
    }

    async getPluginExposureGLB(input: GetPluginExposureGLBInput): Promise<GetPluginExposureGLBOutput> {
        return this.#exposureArtifactService.getExposureGLB(input);
    }

    async getPluginExposureChart(input: GetPluginExposureChartInput): Promise<DownloadStreamOutput> {
        return this.#exposureArtifactService.getExposureChart(input);
    }

    async getPluginExposurePanels(input: GetPluginExposurePanelsInput): Promise<GetPluginExposurePanelsResponse> {
        return this.#exposureArtifactService.getExposurePanels(input);
    }

    async getPluginExposureExport(input: GetPluginExposureExportInput): Promise<DownloadStreamOutput> {
        return this.#exposureArtifactService.getExposureExport(input);
    }

    async getListingRowsByAnalysisId(input: GetListingRowsByAnalysisIdInput): Promise<GetListingRowsByAnalysisIdOutput> {
        return this.#listingQueryService.getListingRowsByAnalysisId(input);
    }

    async getSubListing(input: GetSubListingInput): Promise<GetSubListingOutput> {
        return this.#listingQueryService.getSubListing(input);
    }

    async getPluginListingDocuments(input: GetPluginListingDocumentsInput): Promise<GetPluginListingDocumentsOutput> {
        return this.#listingQueryService.getPluginListingDocuments(input);
    }

    async exportPluginListingDocuments(input: ExportPluginListingDocumentsInput): Promise<DownloadStreamOutput> {
        return this.#listingQueryService.exportPluginListingDocuments(input);
    }

    async getAnalysisListingExportOptions(input: GetAnalysisListingExportOptionsInput): Promise<GetAnalysisListingExportOptionsOutput> {
        return this.#listingExportCatalogService.getExportOptions(input.analysisId);
    }

    async exportListingRowsByAnalysisId(input: ExportListingRowsByAnalysisIdInput): Promise<DownloadStreamOutput> {
        return this.#listingRowsExportService.present(
            await this.#listingExportCatalogService.buildExportPayload(input)
        );
    }
}
