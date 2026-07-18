import eventBus from '@shared/infrastructure/events/RedisEventBus';
import teamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { PluginProps, PluginStatus } from '@modules/plugin/entities/plugin/Plugin';
import Workflow, { WorkflowProps } from '@modules/plugin/entities/plugin/workflow/Workflow';
import { WorkflowNode, WorkflowNodeType } from '@modules/plugin/entities/plugin/workflow/WorkflowNode';
import { ArgumentType, type ArgumentDefinition } from '@modules/plugin/entities/plugin/workflow/nodes/ArgumentNode';

import PluginRepository from '@modules/plugin/services/PluginRepository';
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
import RegistryGateway from '@modules/plugin/services/plugin/RegistryGateway';
import { PluginExposureExportService } from '@modules/plugin/services/exposure/PluginExposureExportService';
import { AnalysisListingExportCatalogService } from '@modules/plugin/services/listing-row/AnalysisListingExportCatalogService';
import { ListingRowsExportPresenter } from '@modules/plugin/presenters/listing-row/ListingRowsExportPresenter';
import type { RegistrySearchResult } from '@modules/plugin/contracts/plugin/RegistryGateway';

import PluginCreatedEvent from '@modules/plugin/events/PluginCreatedEvent';
import PluginDeletedEvent from '@modules/plugin/events/PluginDeletedEvent';
import PluginPublishedEvent from '@modules/plugin/events/PluginPublishedEvent';

import { mapPluginToPersistedDTO, type PersistedPluginDTO } from '@modules/plugin/utilities/mappers/plugin/mapPluginToPersistedDTO';
import WorkflowProjectionService from '@modules/plugin/utilities/plugin/WorkflowProjectionService';
import PluginDisplayNameResolver from '@modules/plugin/utilities/plugin/PluginDisplayNameResolver';
import { computeDumpStageHash, computePipelineStageHash } from '@modules/plugin/utilities/plugin/pipeline-stage-hash';
import { sanitizeVisibleArgumentConfig } from '@modules/plugin/utilities/plugin/argument-visibility';

import {
    buildListingColumns,
    buildListingExportColumns,
    enrichDaemonListingRows
} from '@modules/plugin/utilities/listing-row/listing-row-enrichment';
import { resolveListingPagination } from '@modules/plugin/utilities/listing-row/listing-row-pagination';
import { mapDaemonRow, type DaemonListingRow, type DaemonPaginatedResult } from '@modules/plugin/utilities/listing-row/DaemonListingTypes';
import { toCsvContent } from '@modules/plugin/utilities/listing-row/csv';
import type {
    GetAnalysisListingExportOptionsInputDTO,
    GetAnalysisListingExportOptionsOutputDTO,
    GetListingRowsByAnalysisIdInputDTO,
    GetListingRowsByAnalysisIdOutputDTO,
    ListingRowByAnalysisData,
    ExportListingRowsByAnalysisIdInputDTO,
    SummarizeAnalysisResultInputDTO,
    SummarizeAnalysisResultOutputDTO,
    ColumnStats,
    SummarizedColumn,
    SummarizedExposure
} from '@modules/plugin/utilities/listing-row/listing-row-types';

import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { resolveAnalysisComputeClusterId } from '@shared/application/utilities/cluster-location';
import { getClusterGlbStream } from '@shared/application/utilities/glb-stream-resolution';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import type {
    IStoragePlacementService,
    ITeamClusterObjectGatewayClient,
    ITeamClusterSelectionService
} from '@shared/contracts/ports';
import AnalysisModel, { toAnalysisLike } from '@modules/analysis/models/AnalysisModel';
import ClusterObjectArchiveService from '@modules/cluster/services/ClusterObjectArchiveService';
import ClusterObjectSignedUrlService from '@modules/cluster/services/ClusterObjectSignedUrlService';
import storagePlacementService from '@modules/cluster/services/StoragePlacementService';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import TrajectoryModel from '@modules/trajectory/models/trajectory/TrajectoryModel';
import SceneArtifactModel from '@modules/trajectory/models/scene-artifacts/SceneArtifactModel';
import { getTrajectoryFrames } from '@modules/trajectory/utilities/trajectory/get-trajectory-frames';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { ChannelCommands, type TeamClusterDaemonRegistryInstallResult } from '@shared/infrastructure/contracts/team-cluster';
import { createDownloadStreamResponse } from '@shared/infrastructure/http/responses/download-response';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { ExportType } from '@shared/domain/port/IBaseRepository';
import type { Analysis, AnalysisExpectedArtifact, SceneArtifactProps } from '@shared/contracts/types';
import { SceneArtifactSourceType } from '@shared/contracts/types';
import type { DownloadStreamOutputDTO } from '@shared/contracts/types/DownloadStream';
import type { GetPluginByIdInputDTO } from '@shared/contracts/dtos/GetPluginByIdDTO';
import type { GetPluginExposureGLBInputDTO, GetPluginExposureGLBOutputDTO } from '@shared/contracts/dtos/GetPluginExposureGLBDTO';
import type { GetPluginExposureExportInputDTO, GetPluginExposureExportOutputDTO } from '@shared/contracts/dtos/GetPluginExposureExportDTO';
import type {
    ExportPluginListingDocumentsInputDTO,
    GetPluginListingDocumentsInputDTO,
    GetPluginListingDocumentsOutputDTO,
    PluginListingDocumentsMeta
} from '@shared/contracts/dtos/GetPluginListingDocumentsDTO';
import type { GetSubListingInputDTO, GetSubListingOutputDTO, SubListingColumn } from '@shared/contracts/dtos/GetSubListingDTO';
import logger from '@shared/infrastructure/logger';
import { Readable } from 'node:stream';

export interface ClonePluginInputDTO {
    pluginId: string;
    teamId: string;
}

export interface CreatePluginInputDTO {
    workflow: WorkflowProps;
    teamId: string;
}

export interface DeleteBinaryInputDTO {
    pluginId: string;
}

export interface DeletePluginByIdInputDTO {
    pluginId: string;
}

export interface DescribePluginArgumentsInputDTO {
    pluginId: string;
}

export interface DescribedPluginArgumentOption {
    key: string;
    label: string;
}

export interface DescribedPluginArgument {
    key: string;
    type: ArgumentType;
    label: string;
    required: boolean;
    default?: unknown;
    min?: number;
    max?: number;
    step?: number;
    options?: DescribedPluginArgumentOption[];
    multipleSelection?: boolean;
    inferFromContext?: boolean;
    note?: string;
}

export interface DescribePluginArgumentsOutputDTO {
    pluginId: string;
    name: string;
    arguments: DescribedPluginArgument[];
}

export interface DownloadPluginBinaryInputDTO {
    teamId: string;
    pluginId: string;
}

export interface DownloadPluginBinaryOutputDTO extends DownloadStreamOutputDTO {
    fileName: string;
}

export type PipelineStageKind = 'plugin' | 'slice' | 'expression';

export interface PipelineStageInput {
    kind: PipelineStageKind;
    pluginId?: string;
    config: Record<string, unknown>;
}

export interface ExecutePipelineInputDTO {
    trajectoryId: string;
    userId: string;
    teamId: string;
    teamClusterId?: string;
    selectedTimesteps?: number[];
    timestep?: number;
    stages: PipelineStageInput[];
}

export interface ExecutePipelineOutputDTO {
    analysisIds: string[];
}

export interface ExportPluginInputDTO {
    pluginId: string;
}

export interface ExportPluginOutputDTO extends DownloadStreamOutputDTO {
    fileName: string;
}

export interface GetNodeTypesSchemaOutputDTO {
    nodeTypes: Record<string, string[]>;
}

interface ImportPluginFile {
    buffer: Buffer;
    originalname?: string;
    originalName?: string;
    mimetype?: string;
    size?: number;
}

export interface ImportPluginInputDTO {
    file: ImportPluginFile;
    teamId: string;
}

export interface ListPluginsInputDTO {
    teamId: string;
    page?: number;
    limit?: number;
    status?: string;
}

export interface ListPluginsOutputDTO extends PaginatedResult<PersistedPluginDTO> {}

export interface RegistryInstallPluginInputDTO {
    teamId: string;
    name: string;
    version?: string;
}

export interface SearchRegistryPluginsInputDTO {
    teamId: string;
    q?: string;
    page?: number;
    limit?: number;
}

export interface SearchRegistryPluginsOutputDTO extends RegistrySearchResult {}

export interface UpdatePluginByIdInputDTO {
    pluginId: string;
    workflow?: WorkflowProps;
    status?: PluginStatus;
    _allowBinaryFieldUpdate?: boolean;
}

export interface UploadBinaryInputDTO {
    pluginId: string;
    teamId: string;
    userId: string;
    fileName: string;
    size: number;
    type?: string;
    sha256?: string;
}

export interface CommitBinaryUploadInputDTO {
    pluginId: string;
    teamId: string;
    userId: string;
    objectPath: string;
    fileName: string;
    size: number;
    sha256?: string;
}

export interface ValidateWorkflowInputDTO {
    workflow: WorkflowProps;
    pluginId?: string;
}

export interface ValidateWorkflowOutputDTO {
    validated: boolean;
    errors?: string[];
    modifier?: WorkflowNode;
}

export interface GetPluginExposureChartInputDTO {
    teamId: string;
    artifactId: string;
}

export type GetPluginExposureChartOutputDTO = DownloadStreamOutputDTO;

const REGISTRY_INSTALL_PLATFORM = 'linux-x86_64';

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

const collectSharedExposureIds = (plugin: { props: { exposures?: unknown } }): string[] => {
    const exposures = Array.isArray(plugin.props.exposures) ? plugin.props.exposures : [];
    const ids: string[] = [];
    for (const exposure of exposures) {
        const id = (exposure as { id?: unknown }).id;
        if (typeof id === 'string' && id.length >= 1) {
            ids.push(id);
        }
    }
    return ids;
};

const resolveExpectedArtifacts = (pluginId: string, plugin: { props: { exposures?: unknown } }): AnalysisExpectedArtifact[] => {
    const exposures = Array.isArray(plugin.props.exposures) ? plugin.props.exposures : [];

    const artifacts = exposures
        .filter((exposure): exposure is { _id: string; name?: string; export?: { exporter?: string; type?: string } | null } => {
            return typeof exposure === 'object'
                && exposure !== null
                && typeof (exposure as { _id?: unknown })._id === 'string';
        })
        .filter((exposure) => {
            const exporter = exposure.export?.exporter;
            return typeof exporter === 'string' && EXPECTED_ARTIFACT_EXPORTERS.has(exporter);
        })
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

const isChartArtifact = (metadata: Record<string, unknown> | undefined, objectName: string): boolean => {
    return objectName.endsWith('.png')
        && (
            metadata?.exporter === 'ChartExporter'
            || metadata?.exportType === 'chart-png'
        );
};

const DAEMON_PAGE_SIZE = 200;

const mapDaemonListingRow = (row: DaemonListingRow): ListingRowByAnalysisData => {
    return {
        _id: row._id || '',
        plugin: String(row.plugin || ''),
        exposureId: row.exposureId || '',
        exposureName: row.exposureName || '',
        trajectory: String(row.trajectory || ''),
        trajectoryName: row.trajectoryName as string,
        timestep: row.timestep ?? 0,
        row: (row.row && typeof row.row === 'object') ? row.row : {}
    };
};

const EMPTY_LISTING_ROWS_RESULT: GetListingRowsByAnalysisIdOutputDTO = {
    data: [],
    total: 0,
    page: 1,
    totalPages: 0,
    limit: 0
};

const emptySubListingResult = (subListingName: string): GetSubListingOutputDTO => ({
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
    input: GetPluginListingDocumentsInputDTO
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

const EMPTY_PLUGIN_LISTING_DOCUMENTS_RESULT: GetPluginListingDocumentsOutputDTO = {
    data: [],
    total: 0,
    page: 1,
    totalPages: 0,
    limit: 0,
    _meta: { pluginId: '', exposureName: '', exposureId: '', columns: [], subListingNames: [] }
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

const DEFAULT_MAX_ROWS = 50_000;
const HARD_MAX_ROWS = 200_000;
const TOP_VALUES_LIMIT = 5;

interface ExposureAccumulator {
    exposureId: string;
    exposureName: string;
    rowCount: number;
    columnValues: Map<string, unknown[]>;
}

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

export default class PluginService {
    #pluginRepository = new PluginRepository();
    #pluginDependencyResolverService = new PluginDependencyResolverService(this.#pluginRepository);
    #workflowValidator = new WorkflowValidatorService(this.#pluginDependencyResolverService);
    #pluginStorageService = new PluginStorageService(
        this.#pluginRepository,
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
        this.#pluginRepository,
        teamClusterDaemonClient
    );
    #listingRowsExportPresenter = new ListingRowsExportPresenter(
        new ClusterObjectArchiveService()
    );

    #storagePlacementService: IStoragePlacementService = storagePlacementService;
    #objectGatewayClient: ITeamClusterObjectGatewayClient = objectGatewayClient;
    #sharedObjectGatewayClient: ITeamClusterObjectGatewayClient = objectGatewayClient;

    #teamClusterSelectionService: ITeamClusterSelectionService = teamClusterSelectionService;

        #daemonClient = teamClusterDaemonClient;

        #eventBus = eventBus;


    async getNodeTypesSchema(): Promise<GetNodeTypesSchemaOutputDTO> {
        return {
            nodeTypes: NODE_OUTPUT_PROPERTIES
        };
    }

    async validateWorkflow(input: ValidateWorkflowInputDTO): Promise<ValidateWorkflowOutputDTO> {
        const validation = await this.#workflowValidator.validate(input.workflow, input.pluginId, WorkflowValidationMode.Strict);

        return {
            validated: validation.isValid,
            errors: validation.errors,
            modifier: validation.modifier
        };
    }

    async exportPlugin(input: ExportPluginInputDTO): Promise<ExportPluginOutputDTO> {
        const plugin = await this.#pluginRepository.findById(input.pluginId);

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

    async importPlugin(input: ImportPluginInputDTO): Promise<PersistedPluginDTO> {
        const data = await this.#pluginStorageService.importPlugin(
            input.file.buffer,
            input.teamId
        );

        await this.#eventBus.publish(new PluginCreatedEvent({
            pluginId: data.plugin._id,
            teamId: input.teamId
        }));

        return mapPluginToPersistedDTO(data.plugin);
    }

    async searchRegistry(input: SearchRegistryPluginsInputDTO): Promise<SearchRegistryPluginsOutputDTO> {
        return this.#registryGateway.search(input.q ?? '', input.page ?? 1, input.limit ?? 20);
    }

    async installRegistry(input: RegistryInstallPluginInputDTO): Promise<PersistedPluginDTO> {
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
            { timeoutClass: 'long-running-control-plane', retryClass: 'idempotent-command' }
        );

        const { plugin } = await this.#pluginStorageService.createFromRegistry(
            installed.workflow,
            installed.binary,
            installed.ownerClusterId,
            input.teamId
        );

        await this.#eventBus.publish(new PluginCreatedEvent({
            pluginId: plugin._id,
            teamId: input.teamId
        }));

        return mapPluginToPersistedDTO(plugin);
    }

    async listPlugins(input: ListPluginsInputDTO): Promise<ListPluginsOutputDTO> {
        const result = await this.#pluginRepository.findAll({
            filter: {
                team: input.teamId,
                ...(input.status ? { status: input.status as PluginStatus } : {})
            },
            page: input.page,
            limit: input.limit
        });

        const data = result.data.map((plugin) => mapPluginToPersistedDTO(plugin));

        return {
            ...result,
            data
        };
    }

    async createPlugin(input: CreatePluginInputDTO): Promise<{ plugin: PersistedPluginDTO }> {
        const validation = await this.#workflowValidator.validate(input.workflow, undefined, WorkflowValidationMode.Draft);
        if (!validation.isValid) {
            throw ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_PUBLISH,
                `Plugin workflow is invalid: ${(validation.errors ?? []).join(', ')}`
            );
        }

        const workflow = new Workflow('', input.workflow);
        const projection = WorkflowProjectionService.project(workflow, '');

        const plugin = await this.#pluginRepository.create({
            workflow,
            team: input.teamId,
            status: PluginStatus.Draft,
            modifier: projection.modifier,
            exposures: projection.exposures,
            arguments: projection.arguments,
            listingExposures: projection.listingExposures
        });

        await this.#eventBus.publish(new PluginCreatedEvent({
            pluginId: plugin._id,
            teamId: input.teamId
        }));

        return {
            plugin: mapPluginToPersistedDTO(plugin)
        };
    }

    async commitBinaryUpload(input: CommitBinaryUploadInputDTO): Promise<BinaryUploadResult> {
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

    async downloadBinary(input: DownloadPluginBinaryInputDTO): Promise<DownloadPluginBinaryOutputDTO> {
        const plugin = await this.#pluginRepository.findById(input.pluginId);
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

    async uploadBinary(input: UploadBinaryInputDTO): Promise<BinaryUploadTarget> {
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

    async deleteBinary(input: DeleteBinaryInputDTO): Promise<null> {
        await this.#pluginStorageService.deleteBinary(input.pluginId);
        return null;
    }

    async clonePlugin(input: ClonePluginInputDTO): Promise<{ plugin: PersistedPluginDTO }> {
        const original = await this.#pluginRepository.findById(input.pluginId);
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

        const plugin = await this.#pluginRepository.create({
            workflow,
            team: input.teamId,
            status: PluginStatus.Draft,
            modifier: projection.modifier,
            exposures: projection.exposures,
            arguments: projection.arguments,
            listingExposures: projection.listingExposures
        });

        await this.#eventBus.publish(new PluginCreatedEvent({
            pluginId: plugin._id,
            teamId: input.teamId
        }));

        return {
            plugin: mapPluginToPersistedDTO(plugin)
        };
    }

    async getPluginById(input: GetPluginByIdInputDTO): Promise<PersistedPluginDTO> {
        const plugin = await this.#pluginRepository.findById(input.pluginId);
        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        return mapPluginToPersistedDTO(plugin);
    }

    async updatePluginById(input: UpdatePluginByIdInputDTO): Promise<PersistedPluginDTO> {
        const plugin = await this.#pluginRepository.findById(input.pluginId);
        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        const update: Partial<PluginProps> = {};
        if (input.status) update.status = input.status;

        if (input.workflow) {
            const effectiveStatus = input.status ?? plugin.props.status;
            const validationMode = effectiveStatus === PluginStatus.Published
                ? WorkflowValidationMode.Strict
                : WorkflowValidationMode.Draft;
            const { isValid, errors } = await this.#workflowValidator.validate(input.workflow, plugin.id, validationMode);
            if (effectiveStatus === PluginStatus.Published && !isValid) {
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

            update.workflow = workflow;
            update.modifier = projection.modifier;
            update.exposures = projection.exposures;
            update.arguments = projection.arguments;
            update.listingExposures = projection.listingExposures;
        }

        if (input.status === PluginStatus.Published && !input.workflow) {
            const { isValid, errors } = await this.#workflowValidator.validate(plugin.props.workflow.props, plugin.id, WorkflowValidationMode.Strict);
            if (!isValid) {
                throw ApplicationError.badRequest(
                    ErrorCodes.PLUGIN_NOT_VALID_CANNOT_PUBLISH,
                    `Plugin not valid, cannot publish: ${(errors ?? []).join(', ')}`
                );
            }
        }

        const updatedPlugin = await this.#pluginRepository.updateById(input.pluginId, update);

        if (!updatedPlugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        const transitionedToPublished = input.status === PluginStatus.Published
            && plugin.props.status !== PluginStatus.Published;

        if (transitionedToPublished) {
            const entrypointNode = updatedPlugin.props.workflow.props.nodes
                .find((node) => node.type === WorkflowNodeType.Entrypoint);
            const entrypoint = entrypointNode?.data?.entrypoint;

            await this.#eventBus.publish(new PluginPublishedEvent({
                pluginId: updatedPlugin.id,
                teamId: updatedPlugin.props.team,
                binaryObjectPath: entrypoint?.binaryObjectPath,
                requirementsFile: entrypoint?.requirementsFile,
                entrypointScript: entrypoint?.entrypointScript,
                binaryHash: entrypoint?.binaryHash
            })).catch((error: unknown) => {
                logger.warn({ err: error, pluginId: updatedPlugin.id }, '@plugin-service: failed to publish PluginPublishedEvent');
            });
        }

        return mapPluginToPersistedDTO(updatedPlugin);
    }

    async deletePluginById(input: DeletePluginByIdInputDTO): Promise<null> {
        const plugin = await this.#pluginRepository.findById(input.pluginId);
        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        const deleted = await this.#pluginRepository.deleteById(input.pluginId);
        if (!deleted) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        await this.#eventBus.publish(new PluginDeletedEvent({
            pluginId: plugin.id,
            teamId: plugin.props.team,
            workflow: plugin.props.workflow
        }));

        return null;
    }

    async describePluginArguments(input: DescribePluginArgumentsInputDTO): Promise<DescribePluginArgumentsOutputDTO> {
        const plugin = await this.#pluginRepository.findById(input.pluginId);
        if (!plugin) {
            throw ApplicationError.notFound(
                ErrorCodes.PLUGIN_NOT_FOUND,
                'Plugin not found'
            );
        }

        const definitions = plugin.props.arguments ?? [];

        return {
            pluginId: plugin._id,
            name: plugin.props.modifier?.name ?? plugin._id,
            arguments: definitions.map((definition) => this.#describeArgument(definition))
        };
    }

    #describeArgument(definition: ArgumentDefinition): DescribedPluginArgument {
        const described: DescribedPluginArgument = {
            key: definition.argument,
            type: definition.type,
            label: definition.label,
            required: definition.required ?? false
        };

        if (definition.default !== undefined) {
            described.default = definition.default;
        }
        if (typeof definition.min === 'number') {
            described.min = definition.min;
        }
        if (typeof definition.max === 'number') {
            described.max = definition.max;
        }
        if (typeof definition.step === 'number') {
            described.step = definition.step;
        }
        if (definition.options?.length) {
            described.options = definition.options.map((option) => ({ key: option.key, label: option.label }));
        }
        if (definition.multipleSelection) {
            described.multipleSelection = true;
        }
        if (definition.inferFromContext === true) {
            described.inferFromContext = true;
        }

        const note = this.#buildArgumentNote(definition);
        if (note) {
            described.note = note;
        }

        return described;
    }

    #buildArgumentNote(definition: ArgumentDefinition): string | undefined {
        const notes: string[] = [];

        if (definition.inferFromContext === true) {
            notes.push(`Do NOT set this in config — its value is injected from an upstream pipeline stage that produces the "${definition.argument}" exposure. Put a stage that produces it earlier in the pipeline.`);
        }
        if (definition.type === ArgumentType.List && definition.listArguments?.length) {
            const itemKeys = definition.listArguments.map((item) => item.argument).join(', ');
            notes.push(`List of items; each item has: ${itemKeys}.`);
        }
        if (definition.type === ArgumentType.Tuple && definition.listArguments?.length) {
            const componentKeys = definition.listArguments.map((item) => item.argument).join(', ');
            notes.push(`Single fixed-shape object with fields: ${componentKeys}.`);
        }
        if (definition.type === ArgumentType.PluginReference) {
            notes.push('References another plugin; pass that plugin\'s id/key as the value.');
        }
        if (definition.optionsFromArguments?.length || definition.optionsFromPluginReference) {
            notes.push('Available options depend on other arguments at runtime.');
        }
        if (definition.visibleWhen) {
            notes.push(`Only applies when "${definition.visibleWhen.argument}" ${definition.visibleWhen.operator} its configured value.`);
        }

        return notes.length ? notes.join(' ') : undefined;
    }

    async executePipeline(input: ExecutePipelineInputDTO): Promise<ExecutePipelineOutputDTO> {
        if (input.stages.length === 0) {
            throw ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                'Pipeline has no stages to execute'
            );
        }

        const trajectory = await TrajectoryModel.findById(input.trajectoryId);
        if (!trajectory) {
            throw ApplicationError.badRequest(
                ErrorCodes.TRAJECTORY_NOT_FOUND,
                'Trajectory not found'
            );
        }

        const storageClusterId = trajectory.storageClusterId?.toString();
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
                    stageExecutions.push({ kind: stage.kind, config: stage.config });
                    continue;
                }

                const stageResult = await this.#buildPluginStage(
                    stage,
                    input,
                    trajectory.name,
                    storageClusterId,
                    computeClusterId,
                    trajectoryFramePayloads,
                    [...upstreamStageHashes],
                    resolvedSelectedTimesteps
                );
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
                AnalysisModel.findByIdAndUpdate(analysis._id, {
                    $set: {
                        status: 'failed',
                        finishedAt: new Date()
                    }
                }).catch((updateError: unknown) => {
                    logger.warn(
                        { analysisId: analysis._id, err: updateError },
                        '@plugin-service: failed to mark analysis failed after dispatch error'
                    );
                })
            ));
            throw error;
        }

        return { analysisIds };
    }

    async #buildPluginStage(
        stage: PipelineStageInput,
        input: ExecutePipelineInputDTO,
        trajectoryName: string,
        storageClusterId: string | undefined,
        computeClusterId: string,
        trajectoryFramePayloads: Array<{ timestep: number; natoms: number; simulationCell: string }>,
        upstreamStageHashes: string[],
        selectedTimesteps: number[]
    ): Promise<{
        stageHash: string;
        execution: PipelineStageExecutionInput;
        createdAnalysis?: Analysis;
        error?: ApplicationError;
    }> {
        const fail = (error: ApplicationError) => ({ stageHash: '', execution: { kind: 'plugin' as const }, error });

        if (!stage.pluginId) {
            return fail(ApplicationError.badRequest(ErrorCodes.PLUGIN_NOT_FOUND, 'Pipeline plugin stage is missing a pluginId'));
        }

        const plugin = await this.#pluginRepository.findById(stage.pluginId);
        if (!plugin) {
            return fail(ApplicationError.notFound(ErrorCodes.PLUGIN_NOT_FOUND, `Plugin ${stage.pluginId} not found`));
        }
        if (plugin.props.status !== PluginStatus.Published) {
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

        const cached = await AnalysisModel.findOne({
            pipelineStageHash: stageHash,
            status: 'completed',
            trajectory: input.trajectoryId
        });
        if (cached) {
            return {
                stageHash,
                execution: {
                    kind: 'plugin',
                    cacheHit: true,
                    cacheSourceAnalysisId: cached._id.toString(),
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

        const analysisDoc = await AnalysisModel.create({
            plugin: plugin._id,
            pluginDisplayName,
            computeClusterId,
            storageClusterId,
            config: { ...sanitizedConfig, [ANALYSIS_EXECUTION_METADATA_KEY]: { selectedTimesteps } },
            pipelineStageHash: stageHash,
            team: input.teamId,
            trajectory: input.trajectoryId,
            createdBy: input.userId,
            startedAt: new Date(),
            artifactStatus: 'pending',
            expectedArtifacts: resolveExpectedArtifacts(plugin._id, plugin),
            stages: [],
            childAnalyses: []
        });
        await this.#storagePlacementService.ensurePlacement('analysis', analysisDoc._id.toString());
        const analysis = toAnalysisLike(analysisDoc);

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
            execution: { kind: 'plugin', execution, sharedExposureIds },
            createdAnalysis: analysis
        };
    }


    async getPluginExposureGLB(input: GetPluginExposureGLBInputDTO): Promise<GetPluginExposureGLBOutputDTO> {
        const analysis = await AnalysisModel.findById(String(input.analysisId));

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

        const artifactFilter: Partial<SceneArtifactProps> = {
            trajectory: String(input.trajectoryId),
            analysis: String(input.analysisId),
            sourceType: SceneArtifactSourceType.PluginExposure,
            timestep: Number(input.timestep),
            params: {
                exposureId: String(input.exposureId)
            }
        };

        const artifact = await SceneArtifactModel.findOne(artifactFilter);

        if (!artifact) {
            throw ApplicationError.notFound(
                ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND,
                ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND
            );
        }

        const objectName = artifact.objectName;
        const teamClusterId = artifact.storageClusterId?.toString();
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

            throw ApplicationError.internalServerError(
                'Failed to read plugin exposure GLB from team cluster daemon'
            );
        }
    }

    async getPluginExposureChart(input: GetPluginExposureChartInputDTO): Promise<GetPluginExposureChartOutputDTO> {
        const artifact = await SceneArtifactModel.findById(String(input.artifactId));
        if (!artifact || artifact.sourceType !== SceneArtifactSourceType.PluginExposure) {
            throw ApplicationError.notFound(
                ErrorCodes.FILE_NOT_FOUND,
                ErrorCodes.FILE_NOT_FOUND
            );
        }

        const trajectory = await TrajectoryModel.findById(String(artifact.trajectory));
        if (!trajectory || String(trajectory.team) !== String(input.teamId)) {
            throw ApplicationError.notFound(
                ErrorCodes.FILE_NOT_FOUND,
                ErrorCodes.FILE_NOT_FOUND
            );
        }

        const metadata = artifact.metadata as Record<string, unknown> | undefined;
        if (!isChartArtifact(metadata, artifact.objectName)) {
            throw ApplicationError.badRequest(
                'PluginExposureChart::UnsupportedArtifact',
                'Scene artifact is not a plugin chart'
            );
        }

        const teamClusterId = artifact.storageClusterId?.toString();
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

    async getPluginExposureExport(input: GetPluginExposureExportInputDTO): Promise<GetPluginExposureExportOutputDTO> {
        const analysis = await AnalysisModel.findById(String(input.analysisId));

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
        const plugin = await this.#pluginRepository.findById(pluginId);
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


    async getListingRowsByAnalysisId(input: GetListingRowsByAnalysisIdInputDTO): Promise<GetListingRowsByAnalysisIdOutputDTO> {
        const { page, limit } = resolveListingPagination(input);

        const analysis = await AnalysisModel.findById(input.analysisId);
        const teamClusterId = analysis
            ? resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId?.toString() })
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

    async getAnalysisListingExportOptions(input: GetAnalysisListingExportOptionsInputDTO): Promise<GetAnalysisListingExportOptionsOutputDTO> {
        return this.#analysisListingExportCatalogService.getExportOptions(input.analysisId);
    }

    async exportListingRowsByAnalysisId(input: ExportListingRowsByAnalysisIdInputDTO): Promise<DownloadStreamOutputDTO> {
        const payload = await this.#analysisListingExportCatalogService.buildExportPayload(input);

        return this.#listingRowsExportPresenter.present(payload);
    }

    async getSubListing(input: GetSubListingInputDTO): Promise<GetSubListingOutputDTO> {
        const { page, limit } = resolveListingPagination(input);

        const analysis = await AnalysisModel.findById(input.analysisId);
        const teamClusterId = analysis
            ? resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId?.toString() })
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
            _id: doc._id || '',
            ...((doc.row && typeof doc.row === 'object') ? doc.row : {})
        }));

        let columns: SubListingColumn[] = [];
        if (daemonRows.length > 0) {
            const firstRow = daemonRows[0].row;
            if (firstRow && typeof firstRow === 'object') {
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

    async exportPluginListingDocuments(input: ExportPluginListingDocumentsInputDTO): Promise<DownloadStreamOutputDTO> {
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

    async getPluginListingDocuments(input: GetPluginListingDocumentsInputDTO): Promise<GetPluginListingDocumentsOutputDTO> {
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
            const analysis = await AnalysisModel.findById(input.analysisId);
            const teamClusterId = analysis
                ? resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId?.toString() })
                : undefined;
            if (!teamClusterId) {
                return null;
            }

            return { teamClusterId, analysisId: input.analysisId };
        }

        const filter: Record<string, unknown> = {
            plugin: input.pluginId,
            computeClusterId: { $exists: true, $ne: null }
        };
        if (input.trajectoryId) filter.trajectory = input.trajectoryId;
        if (input.teamId) filter.team = input.teamId;

        const analysis = await AnalysisModel.findOne(filter);
        const teamClusterId = analysis
            ? resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId?.toString() })
            : undefined;
        if (analysis && teamClusterId) {
            return { teamClusterId, analysisId: analysis._id.toString() };
        }

        return null;
    }

    async summarizeAnalysisResult(input: SummarizeAnalysisResultInputDTO): Promise<SummarizeAnalysisResultOutputDTO> {
        const analysis = await AnalysisModel.findById(input.analysisId);
        if (!analysis) {
            throw ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                'Analysis not found'
            );
        }

        const status = analysis.status || 'pending';
        const pluginDisplayName = analysis.pluginDisplayName || analysis.plugin.toString();
        const teamClusterId = resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId?.toString() });

        if (!teamClusterId) {
            return this.#summarizeEmptyResult(input.analysisId, pluginDisplayName, status,
                'No results are available yet — the analysis has not produced queryable output (it may still be pending or running).');
        }

        const { rows, truncated, maxRows } = await this.#summarizeCollectRows(teamClusterId, input.analysisId, input.maxRows);

        const enriched = await enrichDaemonListingRows({
            rows,
            fallbackAnalysisId: input.analysisId
        });

        const trajectoryName = enriched.find((row) => row.trajectoryName)?.trajectoryName
            || (await this.#summarizeResolveTrajectoryName(analysis.trajectory.toString()));

        const filtered = input.exposureId
            ? enriched.filter((row) => row.exposureId === input.exposureId)
            : enriched;

        if (filtered.length === 0) {
            return {
                ...this.#summarizeEmptyResult(input.analysisId, pluginDisplayName, status,
                    status === 'completed'
                        ? 'The analysis completed but returned no tabular result rows for the requested exposure.'
                        : `The analysis is "${status}" and has not produced result rows yet.`),
                trajectoryName
            };
        }

        const exposures = this.#summarizeExposures(filtered);
        const note = truncated
            ? `Statistics computed from the first ${maxRows.toLocaleString('en-US')} rows (result set is larger; sample is truncated).`
            : undefined;

        return {
            analysisId: input.analysisId,
            pluginDisplayName,
            trajectoryName,
            status,
            hasResults: true,
            rowCount: filtered.length,
            sampledRows: filtered.length,
            truncated,
            exposures,
            note
        };
    }

    #summarizeEmptyResult(
        analysisId: string,
        pluginDisplayName: string,
        status: string,
        note: string
    ): SummarizeAnalysisResultOutputDTO {
        return {
            analysisId,
            pluginDisplayName,
            trajectoryName: '',
            status,
            hasResults: false,
            rowCount: 0,
            sampledRows: 0,
            truncated: false,
            exposures: [],
            note
        };
    }

    async #summarizeResolveTrajectoryName(trajectoryId?: string): Promise<string> {
        if (!trajectoryId) {
            return '';
        }

        const trajectory = await TrajectoryModel.findById(trajectoryId);
        return trajectory?.name?.trim() || '';
    }

    async #summarizeCollectRows(
        teamClusterId: string,
        analysisId: string,
        requestedMaxRows?: number
    ): Promise<{ rows: DaemonListingRow[]; truncated: boolean; maxRows: number }> {
        const maxRows = Math.min(
            HARD_MAX_ROWS,
            Math.max(1, Math.floor(requestedMaxRows ?? DEFAULT_MAX_ROWS))
        );

        const rows: DaemonListingRow[] = [];
        let page = 1;
        let totalPages = 1;
        let truncated = false;

        do {
            const daemonResult = await this.#daemonClient.command<DaemonPaginatedResult>(
                teamClusterId,
                ChannelCommands.PluginListingsList,
                { analysisId, page, limit: DAEMON_PAGE_SIZE }
            );

            totalPages = Math.max(1, daemonResult.totalPages || 1);

            for (const row of daemonResult.data || []) {
                if (rows.length >= maxRows) {
                    truncated = true;
                    break;
                }
                rows.push(row);
            }

            if (truncated) {
                break;
            }

            page += 1;
        } while (page <= totalPages);

        return { rows, truncated, maxRows };
    }

    #summarizeExposures(rows: DaemonListingRow[]): SummarizedExposure[] {
        const accumulators = new Map<string, ExposureAccumulator>();

        for (const row of rows) {
            const exposureId = row.exposureId || 'exposure';
            const exposureName = row.exposureName || exposureId;
            const key = `${exposureId}::${exposureName}`;

            const accumulator = accumulators.get(key) ?? {
                exposureId,
                exposureName,
                rowCount: 0,
                columnValues: new Map<string, unknown[]>()
            };

            accumulator.rowCount += 1;

            const data = (row.row && typeof row.row === 'object' && !Array.isArray(row.row))
                ? row.row
                : {};

            for (const [column, value] of Object.entries(data)) {
                const values = accumulator.columnValues.get(column) ?? [];
                values.push(value);
                accumulator.columnValues.set(column, values);
            }

            accumulators.set(key, accumulator);
        }

        return Array.from(accumulators.values())
            .sort((left, right) => left.exposureName.localeCompare(right.exposureName))
            .map((accumulator) => ({
                exposureId: accumulator.exposureId,
                exposureName: accumulator.exposureName,
                rowCount: accumulator.rowCount,
                columns: this.#summarizeColumns(accumulator.columnValues)
            }));
    }

    #summarizeColumns(columnValues: Map<string, unknown[]>): SummarizedColumn[] {
        return Array.from(columnValues.entries())
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([name, values]) => ({
                name,
                stats: this.#summarizeComputeColumnStats(values)
            }));
    }

    #summarizeComputeColumnStats(values: unknown[]): ColumnStats {
        const nonNull = values.filter((value) => value !== null && value !== undefined);
        const nullCount = values.length - nonNull.length;

        const numeric = nonNull.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
        const isNumeric = nonNull.length > 0 && numeric.length === nonNull.length;

        if (isNumeric) {
            const count = numeric.length;
            let min = Infinity;
            let max = -Infinity;
            let sum = 0;
            for (const value of numeric) {
                if (value < min) min = value;
                if (value > max) max = value;
                sum += value;
            }
            const mean = sum / count;
            const variance = numeric.reduce((acc, value) => acc + (value - mean) ** 2, 0) / count;
            const stddev = Math.sqrt(variance);

            return {
                kind: 'numeric',
                count,
                nullCount,
                min,
                max,
                mean: this.#summarizeRound(mean),
                stddev: this.#summarizeRound(stddev)
            };
        }

        const frequencies = new Map<string, number>();
        for (const value of nonNull) {
            const key = this.#summarizeStringifyValue(value);
            frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
        }

        const topValues = Array.from(frequencies.entries())
            .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
            .slice(0, TOP_VALUES_LIMIT)
            .map(([value, count]) => ({ value, count }));

        return {
            kind: 'categorical',
            count: nonNull.length,
            nullCount,
            distinctCount: frequencies.size,
            topValues
        };
    }

    #summarizeStringifyValue(value: unknown): string {
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    #summarizeRound(value: number): number {
        return Math.round(value * 1e6) / 1e6;
    }
}
