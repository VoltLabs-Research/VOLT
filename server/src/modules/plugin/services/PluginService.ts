import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import PluginEntity from '@modules/plugin/models/Plugin';
import {
    mapPluginToRecord,
    toPluginLike
} from '@modules/plugin/services/plugin/PluginQueries';
import type { Plugin, PluginRecord } from '@modules/plugin/contracts/plugin';
import { PluginStatus } from '@volt/contracts/modules/plugin/enums';
import Workflow, { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import {
    WorkflowNodeType,
    type WorkflowNode
} from '@modules/plugin/models/plugin/workflow/WorkflowTypes';

import PluginStorageService, {
    type BinaryUploadResult,
    type BinaryUploadTarget
} from '@modules/plugin/services/plugin/PluginStorageService';
import { WorkflowValidatorService, WorkflowValidationMode } from '@modules/plugin/services/plugin/WorkflowValidatorService';
import { PluginDependencyResolverService } from '@modules/plugin/services/plugin/PluginDependencyResolverService';
import pluginExecutionRouter, {
    type PipelineStageExecutionInput,
    type RoutePluginExecutionInput
} from '@modules/plugin/services/plugin/PluginExecutionRouter';
import RegistryGateway, { type RegistrySearchResult } from '@modules/plugin/services/plugin/RegistryGateway';
import { PluginExposureExportService } from '@modules/plugin/services/exposure/PluginExposureExportService';
import { AnalysisListingExportCatalogService } from '@modules/plugin/services/listing-row/AnalysisListingExportCatalogService';
import { ListingRowsExportService } from '@modules/plugin/services/listing-row/ListingRowsExportService';

import WorkflowProjectionService, {
    PluginDisplayNameResolver,
    computeDumpStageHash,
    computePipelineStageHash
} from '@modules/plugin/services/plugin/WorkflowProjection';
import { sanitizeVisibleArgumentConfig } from '@modules/plugin/services/plugin/ArgumentVisibility';

import {
    buildListingColumns,
    buildListingExportColumns,
    enrichDaemonListingRows
} from '@modules/plugin/services/listing-row/ListingRowEnrichmentService';
import { mapDaemonRow, toListingRowId, type DaemonListingRow, type DaemonPaginatedResult } from '@modules/plugin/services/listing-row/DaemonListingMapper';
import { toCsvContent } from '@shared/infrastructure/http/responses/ExportFileResponse';
import {
    resolveListingPagination,
    type GetAnalysisListingExportOptionsInput,
    type GetAnalysisListingExportOptionsOutput,
    type GetListingRowsByAnalysisIdInput,
    type GetListingRowsByAnalysisIdOutput,
    type ListingRowByAnalysisData,
    type ExportListingRowsByAnalysisIdInput
} from '@modules/plugin/services/listing-row/ListingRowTypes';

import { DAEMON_PAGE_SIZE } from '@modules/plugin/services/plugin/listing-constants';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { resolveAnalysisComputeClusterId } from '@shared/application/utilities/cluster-location';
import { getClusterGlbStream } from '@shared/application/utilities/glb-stream-resolution';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import type {
    IStoragePlacementService,
    ITeamClusterObjectGatewayClient,
    ITeamClusterSelectionService
} from '@shared/contracts/ports';
import AnalysisEntity from '@modules/analysis/models/Analysis';
import { toAnalysisLike } from '@modules/analysis/services/AnalysisQueries';
import { AnalysisArtifactStatus, AnalysisStatus } from '@modules/analysis/contracts/analysis';
import ClusterObjectArchiveService from '@modules/cluster/services/ClusterObjectArchiveService';
import ClusterObjectSignedUrlService from '@modules/cluster/services/ClusterObjectSignedUrlService';
import storagePlacementService from '@modules/cluster/services/StoragePlacementService';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import TrajectoryEntity from '@modules/trajectory/models/Trajectory';
import SceneArtifactEntity from '@modules/trajectory/models/SceneArtifact';
import type { SceneArtifactMetadata } from '@modules/trajectory/contracts/scene-artifact';
import { getTrajectoryFrames } from '@modules/trajectory/services/trajectory/TrajectoryReader';
import { ChannelCommands, type TeamClusterDaemonRegistryInstallResult } from '@shared/infrastructure/contracts/team-cluster';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import { IsNull, Not } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import { ExportType } from '@shared/domain/port/persistence';
import type { Analysis, AnalysisExpectedArtifact } from '@shared/contracts/types';
import { SceneArtifactSourceType } from '@shared/contracts/types';
import type { SceneArtifactParams } from '@shared/contracts/types/SceneArtifact';
import type { DownloadStreamOutput } from '@shared/contracts/types/DownloadStream';
import type { GetPluginByIdInput } from '@shared/contracts/operations/GetPluginById';
import type { GetPluginExposureGLBInput, GetPluginExposureGLBOutput } from '@shared/contracts/operations/GetPluginExposureGLB';
import type {
    GetPluginExposureExportInput
} from '@shared/contracts/operations/GetPluginExposureExport';
import type {
    ExportPluginListingDocumentsInput,
    GetPluginListingDocumentsInput,
    GetPluginListingDocumentsOutput,
    PluginListingDocumentsMeta
} from '@shared/contracts/operations/GetPluginListingDocuments';
import type { GetSubListingInput, GetSubListingOutput, SubListingColumn } from '@shared/contracts/operations/GetSubListing';
import logger from '@shared/infrastructure/logger';
import { Readable } from 'node:stream';
import type { PipelineStageKind } from '@volt/contracts/modules/plugin/http';
import type {
    UploadBinaryInput as WireUploadBinaryInput,
    CommitBinaryUploadInput as WireCommitBinaryUploadInput
} from '@volt/contracts/modules/plugin/http';

export interface ClonePluginInput {
    pluginId: string;
    teamId: string;
}

export interface CreatePluginInput {
    workflow: WorkflowProps;
    teamId: string;
}

export interface DeleteBinaryInput {
    pluginId: string;
}

export interface DeletePluginByIdInput {
    pluginId: string;
}

export interface DownloadPluginBinaryInput {
    teamId: string;
    pluginId: string;
}

interface DownloadPluginBinaryOutput extends DownloadStreamOutput {
    fileName: string;
}

export interface PipelineStageInput {
    kind: PipelineStageKind;
    pluginId?: string;
    config: Record<string, unknown>;
}

export interface ExecutePipelineInput {
    trajectoryId: string;
    userId: string;
    teamId: string;
    teamClusterId?: string;
    selectedTimesteps?: number[];
    timestep?: number;
    stages: PipelineStageInput[];
}

interface ExecutePipelineOutput {
    analysisIds: string[];
}

export interface ExportPluginInput {
    pluginId: string;
}

interface ExportPluginOutput extends DownloadStreamOutput {
    fileName: string;
}

interface GetNodeTypesSchemaOutput {
    nodeTypes: Record<string, string[]>;
}

interface ImportPluginFile {
    buffer: Buffer;
    originalname?: string;
    originalName?: string;
    mimetype?: string;
    size?: number;
}

export interface ImportPluginInput {
    file: ImportPluginFile;
    teamId: string;
}

export interface ListPluginsInput {
    teamId: string;
    page?: number;
    limit?: number;
    status?: string;
}

interface ListPluginsOutput extends PaginatedResult<PluginRecord> {}

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

interface SearchRegistryPluginsOutput extends RegistrySearchResult {}

export interface UpdatePluginByIdInput {
    pluginId: string;
    workflow?: WorkflowProps;
    status?: PluginStatus;
    _allowBinaryFieldUpdate?: boolean;
}

export interface UploadBinaryInput extends WireUploadBinaryInput {
    pluginId: string;
    teamId: string;
    userId: string;
}

export interface CommitBinaryUploadInput extends WireCommitBinaryUploadInput {
    pluginId: string;
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

export interface GetPluginExposureChartInput {
    teamId: string;
    artifactId: string;
}const REGISTRY_INSTALL_PLATFORM = 'linux-x86_64';

const LIST_PLUGINS_DEFAULT_LIMIT = 100;

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

const EXPECTED_ARTIFACT_EXPORTERS = new Set([
    'AtomisticExporter',
    'MeshExporter',
    'LineExporter',
    'ChartExporter'
]);

const ANALYSIS_EXECUTION_METADATA_KEY = '__voltExecution';

const collectSharedExposureIds = (plugin: Plugin): string[] => {
    const ids: string[] = [];
    for (const exposure of plugin.props.exposures ?? []) {
        if (exposure.id) {
            ids.push(exposure.id);
        }
    }
    return ids;
};

const resolveExpectedArtifacts = (pluginId: string, plugin: Plugin): AnalysisExpectedArtifact[] => {
    const artifacts = (plugin.props.exposures ?? [])
        .filter((exposure) => EXPECTED_ARTIFACT_EXPORTERS.has(exposure.export?.exporter ?? ''))
        .map((exposure): AnalysisExpectedArtifact => ({
            exposureId: exposure._id,
            name: exposure.name || exposure._id,
            pluginId,
            exporter: exposure.export?.exporter,
            exportType: exposure.export?.type,
            status: 'pending'
        }));

    const primaryIndex = artifacts.findIndex((artifact) => artifact.exportType === 'glb');
    const selectedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;

    return artifacts.map((artifact, index) => ({
        ...artifact,
        isPrimary: index === selectedPrimaryIndex
    }));
};

const isChartArtifact = (metadata: SceneArtifactMetadata, objectName: string): boolean => {
    return objectName.endsWith('.png')
        && (
            metadata.exporter === 'ChartExporter'
            || metadata.exportType === 'chart-png'
        );
};

const matchesExposureParams = (params: SceneArtifactParams | null | undefined, exposureId: string): boolean => {
    const entries = Object.entries(params ?? {}).filter(([, value]) => value !== undefined);

    return entries.length === 1
        && entries[0][0] === 'exposureId'
        && entries[0][1] === exposureId;
};

const mapDaemonListingRow = (row: DaemonListingRow): ListingRowByAnalysisData => {
    return {
        _id: toListingRowId(row._id),
        plugin: row.plugin || '',
        exposureId: row.exposureId || '',
        exposureName: row.exposureName || '',
        trajectory: row.trajectory || '',
        trajectoryName: row.trajectoryName as string,
        timestep: row.timestep ?? 0,
        row: row.row ?? {}
    };
};

const EMPTY_LISTING_ROWS_RESULT: GetListingRowsByAnalysisIdOutput = {
    data: [],
    total: 0,
    page: 1,
    totalPages: 0,
    limit: 0
};

const emptySubListingResult = (subListingName: string): GetSubListingOutput => ({
    subListingName,
    columns: [],
    rows: [],
    total: 0,
    page: 1,
    totalPages: 0,
    limit: 0
});

const buildPluginListingDocumentsMeta = (
    pluginId: string,
    rows: DaemonListingRow[],
    daemonResult: DaemonPaginatedResult,
    input: GetPluginListingDocumentsInput
): PluginListingDocumentsMeta => {
    const firstRow = rows[0];

    const columns = buildListingColumns(rows, daemonResult.columns);

    const subListingNames = daemonResult.subListingNames ?? firstRow?.subListingNames ?? [];

    return {
        pluginId,
        exposureName: input.exposureName || firstRow?.exposureName || '',
        exposureId: input.exposureId || firstRow?.exposureId || '',
        columns,
        subListingNames
    };
};

const EMPTY_PLUGIN_LISTING_DOCUMENTS_RESULT: GetPluginListingDocumentsOutput = {
    data: [],
    total: 0,
    page: 1,
    totalPages: 0,
    limit: 0,
    _meta: {
        pluginId: '',
        exposureName: '',
        exposureId: '',
        columns: [],
        subListingNames: []
    }
};

function* serializeListingRows(
    format: ExportType,
    rows: DaemonListingRow[],
    columns: string[]
): Generator<string> {
    if (format === ExportType.Csv) {
        const header = toCsvContent([], columns);
        yield header;
        for (let offset = 0; offset < rows.length; offset += DAEMON_PAGE_SIZE) {
            const batch = rows.slice(offset, offset + DAEMON_PAGE_SIZE).map(mapDaemonRow);
            const chunk = toCsvContent(batch, columns).slice(header.length);
            if (chunk) {
                yield chunk;
            }
        }
        return;
    }

    yield '[';
    for (let index = 0; index < rows.length; index++) {
        yield `${index === 0 ? '' : ','}${JSON.stringify(mapDaemonRow(rows[index]))}`;
    }
    yield ']';
}

const createListingDownloadResponse = ({
    filename,
    format,
    rows,
    columns
}: {
    filename: string;
    format: ExportType;
    rows: DaemonListingRow[];
    columns: string[];
}) => {
    const isCsv = format === ExportType.Csv;
    const extension = isCsv ? 'csv' : 'json';
    const contentType = isCsv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8';

    return createDownloadStreamResponse({
        stream: Readable.from(serializeListingRows(format, rows, columns)),
        contentType,
        filename: `${filename}.${extension}`
    });
};

interface DaemonSubListingRow {
    _id: string;
    row?: Record<string, unknown>;
    [key: string]: unknown;
}

interface DaemonSubListingPaginatedResult {
    data: DaemonSubListingRow[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
}

interface BuildPluginStageParams{
    stage: PipelineStageInput;
    input: ExecutePipelineInput;
    trajectoryName: string;
    storageClusterId?: string;
    computeClusterId: string;
    trajectoryFramePayloads: Array<{ timestep: number; natoms: number; simulationCell: string }>;
    upstreamStageHashes: string[];
    selectedTimesteps: number[];
}

export default class PluginService {
    #pluginDependencyResolverService = new PluginDependencyResolverService();
    #workflowValidator = new WorkflowValidatorService(this.#pluginDependencyResolverService);
    #pluginStorageService = new PluginStorageService(
        storagePlacementService,
        objectGatewayClient,
        this.#workflowValidator,
        new ClusterObjectSignedUrlService(),
        new ClusterObjectArchiveService()
    );
    #pluginExecutionRouter = pluginExecutionRouter;
    #registryGateway = new RegistryGateway();
    #pluginExposureExportService = new PluginExposureExportService(
        objectGatewayClient,
        new ClusterObjectArchiveService()
    );
    #analysisListingExportCatalogService = new AnalysisListingExportCatalogService(
        teamClusterDaemonClient
    );
    #listingRowsExportService = new ListingRowsExportService(
        new ClusterObjectArchiveService()
    );

    #storagePlacementService: IStoragePlacementService = storagePlacementService;
    #objectGatewayClient: ITeamClusterObjectGatewayClient = objectGatewayClient;
    #sharedObjectGatewayClient: ITeamClusterObjectGatewayClient = objectGatewayClient;

    #teamClusterSelectionService: ITeamClusterSelectionService = teamClusterSelectionService;

        #daemonClient = teamClusterDaemonClient;

        #eventBus = eventBus;

    async getNodeTypesSchema(): Promise<GetNodeTypesSchemaOutput> {
        return {
            nodeTypes: NODE_OUTPUT_PROPERTIES
        };
    }

    async validateWorkflow(input: ValidateWorkflowInput): Promise<ValidateWorkflowOutput> {
        const validation = await this.#workflowValidator.validate(input.workflow, input.pluginId, WorkflowValidationMode.Strict);

        return {
            validated: validation.isValid,
            errors: validation.errors,
            modifier: validation.modifier
        };
    }

    async exportPlugin(input: ExportPluginInput): Promise<ExportPluginOutput> {
        const pluginEntity = await PluginEntity.findOneBy({ id: input.pluginId });
        const plugin = pluginEntity ? toPluginLike(pluginEntity) : null;

        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        const fileName = `${plugin._id}.zip`;
        const stream = await this.#pluginStorageService.exportPlugin(input.pluginId);

        return {
            ...createDownloadStreamResponse({
                stream,
                contentType: 'application/zip',
                filename: fileName
            }),
            fileName
        };
    }

    async importPlugin(input: ImportPluginInput): Promise<PluginRecord> {
        const data = await this.#pluginStorageService.importPlugin(
            input.file.buffer,
            input.teamId
        );

        await this.#eventBus.emit('plugin.created', {
            pluginId: data.plugin._id,
            teamId: input.teamId
        });

        return mapPluginToRecord(data.plugin);
    }

    async searchRegistry(input: SearchRegistryPluginsInput): Promise<SearchRegistryPluginsOutput> {
        return this.#registryGateway.search(input.q ?? '', input.page ?? 1, input.limit ?? 20);
    }

    async installRegistry(input: RegistryInstallPluginInput): Promise<PluginRecord> {
        if (!input.name) {
            throw ApplicationError.badRequest('Registry::PackageNameRequired', 'A registry package name is required');
        }

        const computeClusterId = await this.#teamClusterSelectionService.resolveComputeClusterId(input.teamId);
        const tarball = await this.#registryGateway.resolveTarball(input.name, input.version, REGISTRY_INSTALL_PLATFORM);

        const installed = await this.#daemonClient.command<TeamClusterDaemonRegistryInstallResult>(
            computeClusterId,
            ChannelCommands.PluginRegistryInstall,
            {
                downloadUrl: tarball.downloadUrl,
                sha256: tarball.sha256,
                fileName: tarball.fileName,
                name: input.name,
                version: tarball.version,
                platform: REGISTRY_INSTALL_PLATFORM
            },
            {
                timeoutClass: 'long-running-control-plane',
                retryClass: 'idempotent-command'
            }
        );

        const { plugin } = await this.#pluginStorageService.createFromRegistry(
            installed.workflow,
            installed.binary,
            installed.ownerClusterId,
            input.teamId
        );

        await this.#eventBus.emit('plugin.created', {
            pluginId: plugin._id,
            teamId: input.teamId
        });

        return mapPluginToRecord(plugin);
    }

    async listPlugins(input: ListPluginsInput): Promise<ListPluginsOutput> {
        const where: FindOptionsWhere<PluginEntity> = {
            team: input.teamId,
            ...(input.status ? { status: input.status as PluginStatus } : {})
        };
        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: LIST_PLUGINS_DEFAULT_LIMIT });

        const [plugins, total] = await PluginEntity.findAndCount({
            where,
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        const data = plugins.map((plugin) => mapPluginToRecord(toPluginLike(plugin)));

        return paginate([data, total], pageRequest);
    }

    async createPlugin(input: CreatePluginInput): Promise<{ plugin: PluginRecord }> {
        const validation = await this.#workflowValidator.validate(input.workflow, undefined, WorkflowValidationMode.Draft);
        if (!validation.isValid) {
            throw ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_PUBLISH,
                `Plugin workflow is invalid: ${(validation.errors ?? []).join(', ')}`
            );
        }

        const workflow = new Workflow('', input.workflow);
        const projection = WorkflowProjectionService.project(workflow, '');

        const pluginEntity = await PluginEntity.create({
            workflow: workflow.props,
            team: input.teamId,
            status: PluginStatus.DRAFT,
            modifier: projection.modifier,
            exposures: projection.exposures,
            arguments: projection.arguments,
            listingExposures: projection.listingExposures
        }).save();
        const plugin = toPluginLike(pluginEntity);

        await this.#eventBus.emit('plugin.created', {
            pluginId: plugin._id,
            teamId: input.teamId
        });

        return {
            plugin: mapPluginToRecord(plugin)
        };
    }

    async commitBinaryUpload(input: CommitBinaryUploadInput): Promise<BinaryUploadResult> {
        return this.#pluginStorageService.commitBinaryUpload(
            input.pluginId,
            input.teamId,
            {
                objectPath: input.objectPath,
                fileName: input.fileName,
                size: input.size,
                sha256: input.sha256
            }
        );
    }

    async downloadBinary(input: DownloadPluginBinaryInput): Promise<DownloadPluginBinaryOutput> {
        const pluginEntity = await PluginEntity.findOneBy({ id: input.pluginId });
        const plugin = pluginEntity ? toPluginLike(pluginEntity) : null;
        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        if (plugin.props.team !== input.teamId) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        const entrypointNode = plugin.props.workflow.props.nodes.find(
            (node) => node.type === WorkflowNodeType.Entrypoint
        );
        const binaryObjectPath = entrypointNode?.data.entrypoint?.binaryObjectPath;
        const binaryFileName = entrypointNode?.data.entrypoint?.binaryFileName;
        const binaryHash = entrypointNode?.data.entrypoint?.binaryHash;

        if (!binaryObjectPath) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                `Plugin binary not found for plugin ${input.pluginId}`
            );
        }

        const placement = await this.#storagePlacementService.ensurePlacement('plugin-binary', plugin.id);

        let stream;
        try {
            stream = await this.#objectGatewayClient.getStream(
                placement.props.primaryClusterId,
                TEAM_CLUSTER_BUCKETS.PLUGINS,
                binaryObjectPath
            );
        } catch (error: unknown) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                throw ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    `Plugin binary not found for plugin ${input.pluginId}`
                );
            }
            throw error;
        }

        const fileName = binaryFileName || `${plugin._id}.bin`;
        const response = createDownloadStreamResponse({
            stream: stream.stream,
            contentType: 'application/octet-stream',
            filename: fileName,
            cacheControl: 'no-cache'
        });

        if (binaryHash) {
            response.headers['X-Plugin-Binary-Sha256'] = binaryHash;
        }

        return {
            ...response,
            fileName
        };
    }

    async uploadBinary(input: UploadBinaryInput): Promise<BinaryUploadTarget> {
        return this.#pluginStorageService.createBinaryUploadTarget(
            input.pluginId,
            input.teamId,
            {
                userId: input.userId,
                fileName: input.fileName,
                size: input.size,
                contentType: input.type,
                sha256: input.sha256
            }
        );
    }

    async deleteBinary(input: DeleteBinaryInput): Promise<null> {
        await this.#pluginStorageService.deleteBinary(input.pluginId);
        return null;
    }

    async clonePlugin(input: ClonePluginInput): Promise<{ plugin: PluginRecord }> {
        const originalEntity = await PluginEntity.findOneBy({ id: input.pluginId });
        const original = originalEntity ? toPluginLike(originalEntity) : null;
        if (!original) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        const clonedNodes = original.props.workflow.props.nodes.map((node) => {
            if (node.type !== WorkflowNodeType.Modifier) return node;
            return {
                ...node,
                data: {
                    ...node.data,
                    modifier: {
                        ...node.data.modifier,
                        name: `${node.data.modifier!.name} (Copy)`
                    }
                }
            };
        });

        const clonedWorkflowProps = {
            ...original.props.workflow.props,
            nodes: clonedNodes
        };

        const workflow = new Workflow('', clonedWorkflowProps);
        const projection = WorkflowProjectionService.project(workflow, '');

        const pluginEntity = await PluginEntity.create({
            workflow: workflow.props,
            team: input.teamId,
            status: PluginStatus.DRAFT,
            modifier: projection.modifier,
            exposures: projection.exposures,
            arguments: projection.arguments,
            listingExposures: projection.listingExposures
        }).save();
        const plugin = toPluginLike(pluginEntity);

        await this.#eventBus.emit('plugin.created', {
            pluginId: plugin._id,
            teamId: input.teamId
        });

        return {
            plugin: mapPluginToRecord(plugin)
        };
    }

    async getPluginById(input: GetPluginByIdInput): Promise<PluginRecord> {
        const pluginEntity = await PluginEntity.findOneBy({ id: input.pluginId });
        const plugin = pluginEntity ? toPluginLike(pluginEntity) : null;
        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        return mapPluginToRecord(plugin);
    }

    async updatePluginById(input: UpdatePluginByIdInput): Promise<PluginRecord> {
        const pluginEntity = await PluginEntity.findOneBy({ id: input.pluginId });
        const plugin = pluginEntity ? toPluginLike(pluginEntity) : null;
        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        const update: Partial<PluginEntity> = {};
        if (input.status) update.status = input.status;

        if (input.workflow) {
            const effectiveStatus = input.status ?? plugin.props.status;
            const validationMode = effectiveStatus === PluginStatus.PUBLISHED
                ? WorkflowValidationMode.Strict
                : WorkflowValidationMode.Draft;
            const { isValid, errors } = await this.#workflowValidator.validate(input.workflow, plugin.id, validationMode);
            if (effectiveStatus === PluginStatus.PUBLISHED && !isValid) {
                throw ApplicationError.badRequest(
                    ErrorCodes.PLUGIN_NOT_VALID_CANNOT_PUBLISH,
                    `Plugin not valid, cannot publish: ${(errors ?? []).join(', ')}`
                );
            }

            if (!input._allowBinaryFieldUpdate) {
                const currentEntrypoint = plugin.props.workflow.props.nodes
                    .find((n) => n.type === WorkflowNodeType.Entrypoint);
                const incomingEntrypoint = input.workflow.nodes
                    .find((n) => n.type === WorkflowNodeType.Entrypoint);

                if (currentEntrypoint?.data?.entrypoint && incomingEntrypoint?.data?.entrypoint) {
                    const { binary, binaryObjectPath, binaryFileName, binaryHash } = currentEntrypoint.data.entrypoint;
                    incomingEntrypoint.data.entrypoint = {
                        ...incomingEntrypoint.data.entrypoint,
                        binary,
                        binaryObjectPath,
                        binaryFileName,
                        binaryHash
                    };
                }
            }

            const workflow = new Workflow(plugin._id, input.workflow);
            const projection = WorkflowProjectionService.project(workflow, plugin._id);

            update.workflow = workflow.props;
            update.modifier = projection.modifier;
            update.exposures = projection.exposures;
            update.arguments = projection.arguments;
            update.listingExposures = projection.listingExposures;
        }

        if (input.status === PluginStatus.PUBLISHED && !input.workflow) {
            const { isValid, errors } = await this.#workflowValidator.validate(plugin.props.workflow.props, plugin.id, WorkflowValidationMode.Strict);
            if (!isValid) {
                throw ApplicationError.badRequest(
                    ErrorCodes.PLUGIN_NOT_VALID_CANNOT_PUBLISH,
                    `Plugin not valid, cannot publish: ${(errors ?? []).join(', ')}`
                );
            }
        }

        const currentEntity = await PluginEntity.findOneBy({ id: input.pluginId });
        const updatedPlugin = currentEntity
            ? toPluginLike(await Object.assign(currentEntity, update).save())
            : null;

        if (!updatedPlugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        const transitionedToPublished = input.status === PluginStatus.PUBLISHED
            && plugin.props.status !== PluginStatus.PUBLISHED;

        if (transitionedToPublished) {
            const entrypointNode = updatedPlugin.props.workflow.props.nodes
                .find((node) => node.type === WorkflowNodeType.Entrypoint);
            const entrypoint = entrypointNode?.data?.entrypoint;

            await this.#eventBus.emit('plugin.published', {
                pluginId: updatedPlugin.id,
                teamId: updatedPlugin.props.team,
                binaryObjectPath: entrypoint?.binaryObjectPath,
                requirementsFile: entrypoint?.requirementsFile,
                entrypointScript: entrypoint?.entrypointScript,
                binaryHash: entrypoint?.binaryHash
            }).catch((error: unknown) => {
                logger.warn({
                    err: error,
                    pluginId: updatedPlugin.id
                }, '@plugin-service: failed to publish plugin.published');
            });
        }

        return mapPluginToRecord(updatedPlugin);
    }

    async deletePluginById(input: DeletePluginByIdInput): Promise<null> {
        const pluginEntity = await PluginEntity.findOneBy({ id: input.pluginId });
        const plugin = pluginEntity ? toPluginLike(pluginEntity) : null;
        if (!plugin || !pluginEntity) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        await pluginEntity.remove();

        await this.#eventBus.emit('plugin.deleted', {
            pluginId: plugin.id,
            teamId: plugin.props.team,
            workflow: plugin.props.workflow
        });

        return null;
    }

    async executePipeline(input: ExecutePipelineInput): Promise<ExecutePipelineOutput> {
        if (input.stages.length === 0) {
            throw ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                'Pipeline has no stages to execute'
            );
        }

        const trajectory = await TrajectoryEntity.findOneBy({ id: input.trajectoryId });
        if (!trajectory) {
            throw ApplicationError.badRequest(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            );
        }

        const storageClusterId = trajectory.storageClusterId;
        const computeClusterId = await this.#teamClusterSelectionService.resolveComputeClusterId(
            input.teamId,
            input.teamClusterId,
            storageClusterId
        );

        const trajectoryFrames = await getTrajectoryFrames(input.trajectoryId);
        const trajectoryFramePayloads = trajectoryFrames.map((frame) => ({
            timestep: frame.timestep,
            natoms: frame.natoms,
            simulationCell: (typeof frame.simulationCell === 'string'
                ? frame.simulationCell
                : frame.simulationCell?._id) ?? ''
        }));

        const resolvedSelectedTimesteps = input.selectedTimesteps?.length
            ? input.selectedTimesteps
            : trajectoryFramePayloads.map((frame) => frame.timestep);

        if (resolvedSelectedTimesteps.length === 0) {
            throw ApplicationError.unprocessableEntity(
                ErrorCodes.TRAJECTORY_DATA_PARSE_FAILED,
                'This trajectory has no frames to run the pipeline on. Wait for trajectory processing to finish, or re-upload a valid trajectory.'
            );
        }

        const upstreamStageHashes: string[] = [];
        const stageExecutions: PipelineStageExecutionInput[] = [];
        const createdAnalyses: Analysis[] = [];
        const analysisIds: string[] = [];

        try {
            for (const stage of input.stages) {
                if (stage.kind !== 'plugin') {
                    upstreamStageHashes.push(computeDumpStageHash(stage.kind, stage.config));
                    stageExecutions.push({
                        kind: stage.kind,
                        config: stage.config
                    });
                    continue;
                }

                const stageResult = await this.#buildPluginStage({
                    stage,
                    input,
                    trajectoryName: trajectory.name,
                    storageClusterId,
                    computeClusterId,
                    trajectoryFramePayloads,
                    upstreamStageHashes: [...upstreamStageHashes],
                    selectedTimesteps: resolvedSelectedTimesteps
                });
                if (stageResult.error) {
                    throw stageResult.error;
                }

                upstreamStageHashes.push(stageResult.stageHash);
                stageExecutions.push(stageResult.execution);
                if (stageResult.createdAnalysis) {
                    createdAnalyses.push(stageResult.createdAnalysis);
                    analysisIds.push(stageResult.createdAnalysis._id);
                }
            }

            await this.#pluginExecutionRouter.routePipeline({
                teamClusterId: computeClusterId,
                teamId: input.teamId,
                trajectoryId: input.trajectoryId,
                trajectoryName: trajectory.name,
                trajectoryFrames: trajectoryFramePayloads,
                storageClusterId,
                selectedTimesteps: resolvedSelectedTimesteps,
                timestep: input.timestep,
                stages: stageExecutions
            });
        } catch (error: unknown) {
            await Promise.all(createdAnalyses.map((analysis) =>
                AnalysisEntity.update(analysis._id, {
                    status: AnalysisStatus.Failed,
                    finishedAt: new Date()
                }).catch((updateError: unknown) => {
                    logger.warn(
                        {
                            analysisId: analysis._id,
                            err: updateError
                        },
                        '@plugin-service: failed to mark analysis failed after dispatch error'
                    );
                })
            ));
            throw error;
        }

        return { analysisIds };
    }

    async #buildPluginStage({
        stage,
        input,
        trajectoryName,
        storageClusterId,
        computeClusterId,
        trajectoryFramePayloads,
        upstreamStageHashes,
        selectedTimesteps
    }: BuildPluginStageParams): Promise<{
        stageHash: string;
        execution: PipelineStageExecutionInput;
        createdAnalysis?: Analysis;
        error?: ApplicationError;
    }> {
        const fail = (error: ApplicationError) => ({
            stageHash: '',
            execution: { kind: 'plugin' as const },
            error
        });

        if (!stage.pluginId) {
            return fail(ApplicationError.badRequest(ErrorCodes.PLUGIN_NOT_FOUND, 'Pipeline plugin stage is missing a pluginId'));
        }

        const stagePluginEntity = await PluginEntity.findOneBy({ id: stage.pluginId });
        const plugin = stagePluginEntity ? toPluginLike(stagePluginEntity) : null;
        if (!plugin) {
            return fail(ApplicationError.notFound(ErrorCodes.PLUGIN_NOT_FOUND, `Plugin ${stage.pluginId} not found`));
        }
        if (plugin.props.status !== PluginStatus.PUBLISHED) {
            return fail(ApplicationError.badRequest(ErrorCodes.PLUGIN_NOT_FOUND, `Plugin ${stage.pluginId} is not published`));
        }

        const { isValid, errors } = await this.#workflowValidator.validate(
            plugin.props.workflow.props,
            plugin.id,
            WorkflowValidationMode.Strict
        );
        if (!isValid) {
            const detail = errors?.length ? `: ${errors.join('; ')}` : '';
            return fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                `Plugin workflow is invalid${detail}`
            ));
        }

        const pluginDisplayName = PluginDisplayNameResolver.resolve(plugin.props.workflow);
        if (!pluginDisplayName) {
            return fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                'Modifier node must define a non-empty name'
            ));
        }

        const sanitizedConfig = sanitizeVisibleArgumentConfig(plugin.props.arguments ?? [], stage.config);
        const sharedExposureIds = collectSharedExposureIds(plugin);
        const stageHash = computePipelineStageHash({
            trajectoryId: input.trajectoryId,
            selectedTimesteps,
            upstreamStageHashes,
            pluginId: plugin._id,
            config: sanitizedConfig
        });

        const cached = await AnalysisEntity.findOneBy({
            pipelineStageHash: stageHash,
            status: AnalysisStatus.Completed,
            trajectory: input.trajectoryId
        });
        if (cached) {
            return {
                stageHash,
                execution: {
                    kind: 'plugin',
                    cacheHit: true,
                    cacheSourceAnalysisId: cached.id,
                    sharedExposureIds
                }
            };
        }

        const referenceValidation = await this.#pluginDependencyResolverService.validateArgumentPluginReferenceExecutions(
            plugin,
            sanitizedConfig
        );
        if (referenceValidation.errors.length) {
            return fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                referenceValidation.errors.join('; ')
            ));
        }

        const dependencyResolution = await this.#pluginDependencyResolverService.collectTransitivePublishedDependencies(plugin);
        if (dependencyResolution.errors.length) {
            return fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                dependencyResolution.errors.join('; ')
            ));
        }

        const referencedPluginDependencies = await this.#pluginDependencyResolverService.collectTransitivePublishedDependenciesForPlugins(
            referenceValidation.plugins
        );
        if (referencedPluginDependencies.errors.length) {
            return fail(ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                referencedPluginDependencies.errors.join('; ')
            ));
        }

        const pluginDependencies = Array.from(new Map(
            [
                ...dependencyResolution.dependencies,
                ...referenceValidation.plugins,
                ...referencedPluginDependencies.dependencies
            ].map((candidate) => [candidate.id, candidate])
        ).values());

        const entrypointNode = plugin.props.workflow.props.nodes.find((node) => node.type === 'entrypoint');
        if (entrypointNode?.data.entrypoint?.binaryObjectPath) {
            await this.#storagePlacementService.ensurePlacement('plugin-binary', plugin.id);
        }

        const analysisEntity = await AnalysisEntity.create({
            plugin: plugin._id,
            pluginDisplayName,
            computeClusterId,
            storageClusterId,
            config: {
                ...sanitizedConfig,
                [ANALYSIS_EXECUTION_METADATA_KEY]: { selectedTimesteps }
            },
            pipelineStageHash: stageHash,
            team: input.teamId,
            trajectory: input.trajectoryId,
            createdBy: input.userId,
            startedAt: new Date(),
            artifactStatus: AnalysisArtifactStatus.Pending,
            expectedArtifacts: resolveExpectedArtifacts(plugin._id, plugin),
            stages: [],
            childAnalyses: []
        }).save();
        await this.#storagePlacementService.ensurePlacement('analysis', analysisEntity.id);
        const analysis = toAnalysisLike(analysisEntity);

        const execution: RoutePluginExecutionInput = {
            teamClusterId: computeClusterId,
            analysis,
            analysisId: analysis._id,
            pluginDisplayName,
            trajectoryId: input.trajectoryId,
            trajectoryName,
            trajectoryFrames: trajectoryFramePayloads,
            teamId: input.teamId,
            plugin,
            pluginDependencies,
            pluginReferenceExecutions: referenceValidation.executions,
            config: sanitizedConfig,
            selectedTimesteps,
            timestep: input.timestep
        };

        return {
            stageHash,
            execution: {
                kind: 'plugin',
                execution,
                sharedExposureIds
            },
            createdAnalysis: analysis
        };
    }

    async getPluginExposureGLB(input: GetPluginExposureGLBInput): Promise<GetPluginExposureGLBOutput> {
        const analysis = await AnalysisEntity.findOneBy({ id: String(input.analysisId) });

        if (!analysis) {
            throw ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                ErrorCodes.ANALYSIS_NOT_FOUND
            );
        }

        if (String(analysis.team) !== String(input.teamId)) {
            throw ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                ErrorCodes.ANALYSIS_NOT_FOUND
            );
        }

        const artifactCandidates = await SceneArtifactEntity.findBy({
            trajectory: String(input.trajectoryId),
            analysis: String(input.analysisId),
            sourceType: SceneArtifactSourceType.PluginExposure,
            timestep: Number(input.timestep)
        });

        const artifact = artifactCandidates.find((candidate) =>
            matchesExposureParams(candidate.params, String(input.exposureId)));

        if (!artifact) {
            throw ApplicationError.notFound(
                ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
                ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND
            );
        }

        const objectName = artifact.objectName;
        const teamClusterId = artifact.storageClusterId;
        if (!teamClusterId) {
            throw ApplicationError.conflict(
                'SceneArtifact::StorageClusterRequired',
                'Scene artifact storage cluster is required'
            );
        }
        const requestContext = { acceptEncoding: input.acceptEncoding };

        const buildDownloadResponse = (
            stream: Readable,
            size: number | undefined,
            filename: string,
            contentEncoding: string
        ) => {
            const extraHeaders: Record<string, string> = {};

            if (contentEncoding !== 'identity') {
                extraHeaders['X-Volt-Resource-Encoding'] = contentEncoding;
            }

            return createDownloadStreamResponse({
                stream,
                contentType: 'model/gltf-binary',
                contentLength: size,
                disposition: 'inline',
                filename,
                cacheControl: 'public, max-age=31536000, immutable',
                extraHeaders
            });
        };

        try {
            const response = await getClusterGlbStream(this.#sharedObjectGatewayClient, teamClusterId, objectName, requestContext);

            return buildDownloadResponse(
                response.stream,
                response.size,
                response.objectName,
                response.contentEncoding
            );
        } catch (error) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                throw ApplicationError.notFound(
                    ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
                    ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND
                );
            }

            if (error instanceof ApplicationError && error.statusCode < HttpStatus.InternalServerError) {
                throw error;
            }

            logger.error(error, `Unexpected failure reading plugin exposure GLB teamClusterId=${teamClusterId} objectName=${objectName}`);

            throw ApplicationError.internalServerError(
                'Failed to read plugin exposure GLB from team cluster daemon'
            );
        }
    }

    async getPluginExposureChart(input: GetPluginExposureChartInput): Promise<DownloadStreamOutput> {        const artifact = await SceneArtifactEntity.findOneBy({ id: String(input.artifactId) });
        if (!artifact || artifact.sourceType !== SceneArtifactSourceType.PluginExposure) {
            throw ApplicationError.notFound(
                ErrorCodes.FILE_NOT_FOUND,
                ErrorCodes.FILE_NOT_FOUND
            );
        }

        const trajectory = await TrajectoryEntity.findOneBy({ id: String(artifact.trajectory) });
        if (!trajectory || String(trajectory.team) !== String(input.teamId)) {
            throw ApplicationError.notFound(
                ErrorCodes.FILE_NOT_FOUND,
                ErrorCodes.FILE_NOT_FOUND
            );
        }

        if (!isChartArtifact(artifact.metadata, artifact.objectName)) {
            throw ApplicationError.badRequest(
                'PluginExposureChart::UnsupportedArtifact',
                'Scene artifact is not a plugin chart'
            );
        }

        const teamClusterId = artifact.storageClusterId;
        if (!teamClusterId) {
            throw ApplicationError.conflict(
                'SceneArtifact::StorageClusterRequired',
                'Scene artifact storage cluster is required'
            );
        }

        try {
            const response = await this.#objectGatewayClient.getStream(
                teamClusterId,
                artifact.storageBucket,
                artifact.objectName
            );

            return createDownloadStreamResponse({
                stream: response.stream,
                contentType: 'image/png',
                contentLength: response.contentLength,
                disposition: 'inline',
                filename: artifact.displayName || 'plugin-chart.png',
                cacheControl: 'public, max-age=31536000, immutable'
            });
        } catch (error) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                throw ApplicationError.notFound(
                    ErrorCodes.FILE_NOT_FOUND,
                    ErrorCodes.FILE_NOT_FOUND
                );
            }

            throw ApplicationError.internalServerError(
                'Failed to read plugin chart from team cluster daemon'
            );
        }
    }

    async getPluginExposureExport(input: GetPluginExposureExportInput): Promise<DownloadStreamOutput> {
        const analysis = await AnalysisEntity.findOneBy({ id: String(input.analysisId) });

        if (!analysis) {
            throw ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                ErrorCodes.ANALYSIS_NOT_FOUND
            );
        }

        if (String(analysis.team) !== String(input.teamId)) {
            throw ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                ErrorCodes.ANALYSIS_NOT_FOUND
            );
        }

        const pluginId = String(analysis.plugin);
        const exposureExportPluginEntity = await PluginEntity.findOneBy({ id: pluginId });
        const plugin = exposureExportPluginEntity ? toPluginLike(exposureExportPluginEntity) : null;
        let pluginName = pluginId;

        if (plugin?.props?.modifier?.name) {
            pluginName = plugin.props.modifier.name;
        }

        return this.#pluginExposureExportService.exportAnalysisExposureBundle({
            analysisId: String(input.analysisId),
            trajectoryId: String(analysis.trajectory),
            pluginName
        });
    }

    async getListingRowsByAnalysisId(input: GetListingRowsByAnalysisIdInput): Promise<GetListingRowsByAnalysisIdOutput> {
        const { page, limit } = resolveListingPagination(input);

        const analysis = await AnalysisEntity.findOneBy({ id: input.analysisId });
        const teamClusterId = analysis
            ? resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId ?? undefined })
            : undefined;
        if (!teamClusterId) {
            return EMPTY_LISTING_ROWS_RESULT;
        }

        const daemonResult = await this.#daemonClient.command<DaemonPaginatedResult>(
            teamClusterId,
            ChannelCommands.PluginListingsList,
            {
                teamId: input.teamId,
                analysisId: input.analysisId,
                page,
                limit
            }
        );

        const rows = await enrichDaemonListingRows({
            rows: daemonResult.data || [],
            fallbackAnalysisId: input.analysisId
        });
        const data = rows.map(mapDaemonListingRow);

        return {
            data,
            total: daemonResult.total || 0,
            page: daemonResult.page || page,
            totalPages: daemonResult.totalPages || 1,
            limit: daemonResult.limit || limit
        };
    }

    async getAnalysisListingExportOptions(input: GetAnalysisListingExportOptionsInput): Promise<GetAnalysisListingExportOptionsOutput> {
        return this.#analysisListingExportCatalogService.getExportOptions(input.analysisId);
    }

    async exportListingRowsByAnalysisId(input: ExportListingRowsByAnalysisIdInput): Promise<DownloadStreamOutput> {
        const payload = await this.#analysisListingExportCatalogService.buildExportPayload(input);

        return this.#listingRowsExportService.present(payload);
    }

    async getSubListing(input: GetSubListingInput): Promise<GetSubListingOutput> {
        const { page, limit } = resolveListingPagination(input);

        const analysis = await AnalysisEntity.findOneBy({ id: input.analysisId });
        const teamClusterId = analysis
            ? resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId ?? undefined })
            : undefined;
        if (!teamClusterId) {
            return emptySubListingResult(input.subListingName);
        }

        const daemonResult = await this.#daemonClient.command<DaemonSubListingPaginatedResult>(
            teamClusterId,
            ChannelCommands.PluginSubListingsList,
            {
                teamId: input.teamId,
                analysisId: input.analysisId,
                exposureId: input.exposureId,
                timestep: Number(input.timestep),
                subListingName: input.subListingName,
                page,
                limit
            }
        );

        const daemonRows = daemonResult.data || [];

        const rows = daemonRows.map((doc) => ({
            _id: toListingRowId(doc._id),
            ...(doc.row ?? {})
        }));

        let columns: SubListingColumn[] = [];
        if (daemonRows.length > 0) {
            const firstRow = daemonRows[0].row;
            if (firstRow) {
                columns = Object.keys(firstRow).map((key) => ({
                    label: key,
                    sortable: true
                }));
            }
        }

        return {
            subListingName: input.subListingName,
            columns,
            rows,
            total: daemonResult.total || 0,
            page: daemonResult.page || page,
            totalPages: daemonResult.totalPages || 1,
            limit: daemonResult.limit || limit
        };
    }

    async exportPluginListingDocuments(input: ExportPluginListingDocumentsInput): Promise<DownloadStreamOutput> {
        const format = input.format ?? ExportType.Json;

        const resolved = await this.#resolvePluginListingTeamCluster(input);
        if (!resolved) {
            return createListingDownloadResponse({
                filename: `${input.pluginId}_${input.exposureId || 'unknown'}_listing`,
                format,
                rows: [],
                columns: []
            });
        }

        const allRows: DaemonListingRow[] = [];
        let currentPage = 1;
        let totalPages = 1;

        do {
            const result = await this.#daemonClient.command<DaemonPaginatedResult>(
                resolved.teamClusterId,
                ChannelCommands.PluginListingsList,
                {
                    pluginId: input.pluginId,
                    teamId: input.teamId,
                    analysisId: resolved.analysisId,
                    trajectoryId: input.trajectoryId,
                    exposureId: input.exposureId,
                    exposureName: input.exposureName,
                    page: currentPage,
                    limit: DAEMON_PAGE_SIZE
                }
            );

            allRows.push(...(result.data || []));
            totalPages = result.totalPages || 1;
            currentPage++;
        } while (currentPage <= totalPages);

        const rows = await enrichDaemonListingRows({
            rows: allRows,
            fallbackAnalysisId: resolved.analysisId
        });
        const columns = buildListingExportColumns(rows);
        const exposureId = input.exposureId || rows[0]?.exposureId || '';

        return createListingDownloadResponse({
            filename: `${input.pluginId}_${exposureId}_listing`,
            format,
            rows,
            columns
        });
    }

    async getPluginListingDocuments(input: GetPluginListingDocumentsInput): Promise<GetPluginListingDocumentsOutput> {
        const { page, limit } = resolveListingPagination(input);

        const resolved = await this.#resolvePluginListingTeamCluster(input);
        if (!resolved) {
            return EMPTY_PLUGIN_LISTING_DOCUMENTS_RESULT;
        }

        const daemonResult = await this.#daemonClient.command<DaemonPaginatedResult>(
            resolved.teamClusterId,
            ChannelCommands.PluginListingsList,
            {
                pluginId: input.pluginId,
                teamId: input.teamId,
                analysisId: resolved.analysisId,
                trajectoryId: input.trajectoryId,
                exposureId: input.exposureId,
                exposureName: input.exposureName,
                page,
                limit
            }
        );

        const rows = await enrichDaemonListingRows({
            rows: daemonResult.data || [],
            fallbackAnalysisId: resolved.analysisId
        });
        const data = rows.map(mapDaemonRow);

        return {
            data,
            total: daemonResult.total || 0,
            page: daemonResult.page || page,
            totalPages: daemonResult.totalPages || 1,
            limit: daemonResult.limit || limit,
            _meta: buildPluginListingDocumentsMeta(input.pluginId, rows, daemonResult, input)
        };
    }

    async #resolvePluginListingTeamCluster(
        input: { pluginId: string; teamId: string; analysisId?: string; trajectoryId?: string }
    ): Promise<{ teamClusterId: string; analysisId: string } | null> {
        if (input.analysisId) {
            const analysis = await AnalysisEntity.findOneBy({ id: input.analysisId });
            const teamClusterId = analysis
                ? resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId ?? undefined })
                : undefined;
            if (!teamClusterId) {
                return null;
            }

            return {
                teamClusterId,
                analysisId: input.analysisId
            };
        }

        const where: FindOptionsWhere<AnalysisEntity> = {
            plugin: input.pluginId,
            computeClusterId: Not(IsNull())
        };
        if (input.trajectoryId) where.trajectory = input.trajectoryId;
        if (input.teamId) where.team = input.teamId;

        const analysis = await AnalysisEntity.findOneBy(where);
        const teamClusterId = analysis
            ? resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId ?? undefined })
            : undefined;
        if (analysis && teamClusterId) {
            return {
                teamClusterId,
                analysisId: analysis.id
            };
        }

        return null;
    }
}
