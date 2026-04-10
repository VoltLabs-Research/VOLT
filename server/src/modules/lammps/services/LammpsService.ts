import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import { LAMMPS_PACKAGES, isValidLammpsPackage } from '@modules/lammps/domain/LammpsPackages';
import { LammpsContainerStatus, LammpsDumpStatus, LammpsExecutionStatus } from '@modules/lammps/domain/LammpsTypes';
import type { LammpsContainerDocument } from '@modules/lammps/infrastructure/persistence/mongo/models/LammpsContainerModel';
import type { LammpsDumpDocument } from '@modules/lammps/infrastructure/persistence/mongo/models/LammpsDumpModel';
import type { LammpsExecutionDocument } from '@modules/lammps/infrastructure/persistence/mongo/models/LammpsExecutionModel';
import type { LammpsScriptDocument } from '@modules/lammps/infrastructure/persistence/mongo/models/LammpsScriptModel';
import LammpsContainerModel from '@modules/lammps/infrastructure/persistence/mongo/models/LammpsContainerModel';
import LammpsDumpModel from '@modules/lammps/infrastructure/persistence/mongo/models/LammpsDumpModel';
import LammpsExecutionModel from '@modules/lammps/infrastructure/persistence/mongo/models/LammpsExecutionModel';
import LammpsScriptModel from '@modules/lammps/infrastructure/persistence/mongo/models/LammpsScriptModel';
import { TeamClusterStatus, buildTeamClusterEffectiveCapabilities } from '@modules/team-cluster/domain/entities/TeamCluster';
import StoragePlacementService from '@modules/team-cluster/application/services/StoragePlacementService';
import TeamClusterModel from '@modules/team-cluster/infrastructure/persistence/mongo/models/TeamClusterModel';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import type { ISystemMetricsRepository } from '@modules/system/domain/port/ISystemMetricsRepository';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';
import type TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import SimulationCellModel from '@modules/simulation-cell/infrastructure/persistence/mongo/models/SimulationCellModel';
import TrajectoryModel from '@modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryModel';
import { getClusterGlbStream } from '@modules/trajectory/utilities/storage/glb-stream-resolution';
import {
    buildTrajectoryGlbObjectName,
    createZstdDecompressionStream,
    isZstdObjectName
} from '@modules/trajectory/utilities/storage/trajectory-storage-codec';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { sanitizeDownloadName } from '@shared/infrastructure/http/responses/download-response';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import CatalogFolderModel from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';
import { inject, injectable } from 'tsyringe';
import mongoose from 'mongoose';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { LammpsDaemonRuntimeService } from './LammpsDaemonRuntimeService';

interface PaginationInput {
    page?: number;
    limit?: number;
}

interface ScriptFileEntry {
    _id: string;
    kind: 'file' | 'directory';
    name: string;
    path: string;
    relativePath: string;
    parentPath: string | null;
    size: number | null;
    permissions?: string;
    owner?: string;
    group?: string;
    date?: string;
}

interface RunClusterOption {
    _id: string;
    name: string;
    status: string;
    effectiveRole: string;
    acceptsComputeJobs: boolean;
    acceptsStorageWrites: boolean;
}

type PaginatedResponse<T> = {
    data: T[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_ENTRY_FILE_NAME = 'in.lammps';
const DEFAULT_LAMMPS_CPU_COUNT = 1;
const DEFAULT_LAMMPS_MPI_RANK_COUNT = 1;
const DEFAULT_LAMMPS_OPENMP_THREAD_COUNT = 1;

const escapeRegExp = (value: string): string => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const asObjectId = (value: string): mongoose.Types.ObjectId => {
    return new mongoose.Types.ObjectId(value);
};

const assertObjectId = (value: string, label: string): void => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, `${label} is invalid`);
    }
};

const normalizePagination = (input: PaginationInput): Required<PaginationInput> => {
    const page = Number.isFinite(input.page) && input.page && input.page > 0
        ? Math.floor(input.page)
        : DEFAULT_PAGE;
    const limit = Number.isFinite(input.limit) && input.limit && input.limit > 0
        ? Math.min(Math.floor(input.limit), MAX_LIMIT)
        : DEFAULT_LIMIT;

    return { page, limit };
};

const buildPaginatedResponse = <T>(
    data: T[],
    total: number,
    input: Required<PaginationInput>
): PaginatedResponse<T> => {
    return {
        data,
        total,
        page: input.page,
        totalPages: Math.max(1, Math.ceil(total / input.limit)),
        limit: input.limit
    };
};

const normalizeSearchRegex = (value?: string): RegExp | undefined => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return normalized.length > 0
        ? new RegExp(escapeRegExp(normalized), 'i')
        : undefined;
};

const normalizePositiveInteger = (
    value: number | undefined,
    label: string,
    fallback = 1
): number => {
    if (typeof value === 'undefined') {
        return fallback;
    }

    if (!Number.isInteger(value) || value < 1) {
        throw ApplicationError.badRequest(
            ErrorCodes.VALIDATION_INVALID_INPUT,
            `${label} must be an integer greater than or equal to 1`
        );
    }

    return value;
};

const resolveLegacyThreadValue = (value: unknown): number | undefined => {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1
        ? value
        : undefined;
};

const resolveScriptParallelism = (script: {
    mpiRanks?: number;
    openmpThreads?: number;
    threads?: number;
}): {
    mpiRanks: number;
    openmpThreads: number;
} => {
    const legacyThreads = resolveLegacyThreadValue(script.threads);

    return {
        mpiRanks: normalizePositiveInteger(
            typeof script.mpiRanks === 'number' ? script.mpiRanks : legacyThreads,
            'MPI ranks',
            DEFAULT_LAMMPS_MPI_RANK_COUNT
        ),
        openmpThreads: normalizePositiveInteger(
            script.openmpThreads,
            'OpenMP threads',
            DEFAULT_LAMMPS_OPENMP_THREAD_COUNT
        )
    };
};

const buildHybridRuntimeImageTag = (containerId: string): string => {
    return `volt/lammps-runtime:${containerId}-hybrid`;
};

const normalizeRelativePath = (
    value: string,
    options: {
        allowEmpty?: boolean;
        label?: string;
    } = {}
): string => {
    const label = options.label ?? 'Path';
    const normalized = path.posix.normalize((value || '').trim().replace(/\\/g, '/')).replace(/^\/+/, '');

    if (!normalized || normalized === '.') {
        if (options.allowEmpty) {
            return '';
        }

        throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, `${label} is required`);
    }

    if (normalized === '..' || normalized.startsWith('../')) {
        throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, `${label} escapes the project root`);
    }

    return normalized;
};

const buildExecutionStoragePrefix = (trajectoryId: string): string => {
    return `trajectory-${trajectoryId}/`;
};

const parseNumericSize = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
};

const isTerminalExecutionStatus = (status: LammpsExecutionStatus): boolean => {
    return status === LammpsExecutionStatus.Completed
        || status === LammpsExecutionStatus.Cancelled
        || status === LammpsExecutionStatus.Failed;
};

@injectable()
export class LammpsService {
    constructor(
        @inject(LammpsDaemonRuntimeService)
        private readonly lammpsRuntimeService: LammpsDaemonRuntimeService,

        @inject(TeamClusterSelectionService)
        private readonly teamClusterSelectionService: TeamClusterSelectionService,

        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient)
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient,

        @inject(SYSTEM_TOKENS.SystemMetricsRepository)
        private readonly systemMetricsRepository: ISystemMetricsRepository,

        @inject(TEAM_CLUSTER_TOKENS.StoragePlacementService)
        private readonly storagePlacementService: StoragePlacementService
    ) {}

    private async validateRequestedCpuCount(clusterId: string, requestedCpuCount: number, label: string): Promise<void> {
        const metrics = await this.systemMetricsRepository.getLatestByClusterId(clusterId);
        if (!metrics) {
            return;
        }

        const maxCpus = Math.max(1, Math.floor(metrics.cpu.cores));
        if (requestedCpuCount > maxCpus) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                `Requested ${label.toLowerCase()} exceeds cluster capacity (${maxCpus} core${maxCpus === 1 ? '' : 's'} max)`
            );
        }
    }

    private async validateRequestedParallelism(
        clusterId: string,
        mpiRanks: number,
        openmpThreads: number
    ): Promise<void> {
        const metrics = await this.systemMetricsRepository.getLatestByClusterId(clusterId);
        if (!metrics) {
            return;
        }

        const maxCpus = Math.max(1, Math.floor(metrics.cpu.cores));
        const totalCpuDemand = mpiRanks * openmpThreads;

        if (totalCpuDemand > maxCpus) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                `Requested MPI x OpenMP parallelism (${mpiRanks} x ${openmpThreads} = ${totalCpuDemand}) exceeds cluster capacity (${maxCpus} core${maxCpus === 1 ? '' : 's'} max)`
            );
        }
    }

    getAvailablePackages(): readonly string[] {
        return LAMMPS_PACKAGES;
    }

    async listContainers(input: {
        teamId: string;
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<PaginatedResponse<Record<string, unknown>>> {
        const pagination = normalizePagination(input);
        const filter: Record<string, unknown> = {
            team: input.teamId
        };
        const searchRegex = normalizeSearchRegex(input.search);

        if (searchRegex) {
            filter.name = searchRegex;
        }

        const [containers, total] = await Promise.all([
            LammpsContainerModel
                .find(filter)
                .populate('createdBy', 'firstName lastName email')
                .populate('teamClusterId', 'name status roleConfig')
                .populate('storageClusterId', 'name status roleConfig')
                .sort({ updatedAt: -1 })
                .skip((pagination.page - 1) * pagination.limit)
                .limit(pagination.limit)
                .lean()
                .exec(),
            LammpsContainerModel.countDocuments(filter).exec()
        ]);

        return buildPaginatedResponse(containers, total, pagination);
    }

    async createContainer(input: {
        teamId: string;
        userId: string;
        name: string;
        packages: string[];
        teamClusterId?: string;
        cpus?: number;
    }): Promise<Record<string, unknown>> {
        const name = input.name.trim();
        if (name.length === 0) {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Container name is required');
        }

        const normalizedPackages = Array.from(
            new Set(
                input.packages
                    .map((entry) => entry.trim())
                    .filter((entry) => entry.length > 0)
            )
        );

        for (const pkg of normalizedPackages) {
            if (!isValidLammpsPackage(pkg)) {
                throw ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    `Unsupported LAMMPS package: ${pkg}`
                );
            }
        }

        const computeClusterId = await this.teamClusterSelectionService.resolveComputeClusterId(
            input.teamId,
            input.teamClusterId
        );
        const storageClusterId = await this.teamClusterSelectionService.resolveStorageClusterId(
            input.teamId,
            undefined,
            computeClusterId
        );
        const cpus = normalizePositiveInteger(input.cpus, 'Cores', DEFAULT_LAMMPS_CPU_COUNT);
        await this.validateRequestedCpuCount(computeClusterId, cpus, 'cores');
        const operationId = randomUUID();

        const lammpsContainer = await LammpsContainerModel.create({
            team: asObjectId(input.teamId),
            name,
            packages: normalizedPackages,
            cpus,
            teamClusterId: asObjectId(computeClusterId),
            storageClusterId: asObjectId(storageClusterId),
            createdBy: asObjectId(input.userId),
            operationId,
            status: LammpsContainerStatus.Provisioning
        });

        void this.lammpsRuntimeService.provisionContainer(computeClusterId, {
            operationId,
            lammpsContainerId: String(lammpsContainer._id),
            name,
            packages: normalizedPackages,
            cpus
        });

        return this.getContainer({
            teamId: input.teamId,
            containerId: String(lammpsContainer._id)
        });
    }

    async getContainer(input: {
        teamId: string;
        containerId: string;
    }): Promise<Record<string, unknown>> {
        assertObjectId(input.containerId, 'Container id');
        const container = await LammpsContainerModel
            .findOne({
                _id: input.containerId,
                team: input.teamId
            })
            .populate('createdBy', 'firstName lastName email')
            .populate('teamClusterId', 'name status roleConfig')
            .populate('storageClusterId', 'name status roleConfig')
            .lean()
            .exec();

        if (!container) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LAMMPS container not found');
        }

        return container;
    }

    async deleteContainer(input: {
        teamId: string;
        containerId: string;
    }): Promise<void> {
        const container = await this.requireContainer(input.teamId, input.containerId);
        const scriptsCount = await LammpsScriptModel.countDocuments({
            team: input.teamId,
            container: container._id
        }).exec();

        if (scriptsCount > 0) {
            throw ApplicationError.conflict(
                'LAMMPS_CONTAINER_HAS_SCRIPTS',
                'Delete the scripts that use this container before deleting it'
            );
        }

        if (container.workspaceContainerId) {
            await this.lammpsRuntimeService.removeWorkspaceContainer(String(container.teamClusterId), {
                workspaceContainerId: container.workspaceContainerId
            });
        }

        await LammpsContainerModel.deleteOne({ _id: container._id }).exec();
    }

    async listFolders(input: {
        teamId: string;
        page?: number;
        limit?: number;
        parentId?: string | null;
    }): Promise<PaginatedResponse<Record<string, unknown>>> {
        const pagination = normalizePagination(input);
        if (input.parentId) {
            assertObjectId(input.parentId, 'Parent folder id');
        }

        const filter = {
            team: input.teamId,
            kind: CatalogFolderKind.Lammps,
            parent: input.parentId ?? null
        };

        const [folders, total] = await Promise.all([
            CatalogFolderModel.find(filter)
                .populate('createdBy', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .skip((pagination.page - 1) * pagination.limit)
                .limit(pagination.limit)
                .lean()
                .exec(),
            CatalogFolderModel.countDocuments(filter).exec()
        ]);

        return buildPaginatedResponse(folders, total, pagination);
    }

    async createFolder(input: {
        teamId: string;
        userId: string;
        title: string;
        parentId?: string | null;
    }): Promise<Record<string, unknown>> {
        const title = input.title.trim();
        if (title.length === 0) {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Folder title is required');
        }

        if (input.parentId) {
            await this.requireFolder(input.teamId, input.parentId);
        }

        const folder = await CatalogFolderModel.create({
            team: asObjectId(input.teamId),
            createdBy: asObjectId(input.userId),
            title,
            parent: input.parentId ? asObjectId(input.parentId) : null,
            kind: CatalogFolderKind.Lammps
        });

        return folder.toObject() as unknown as Record<string, unknown>;
    }

    async updateFolder(input: {
        teamId: string;
        folderId: string;
        title: string;
    }): Promise<Record<string, unknown>> {
        const folder = await this.requireFolder(input.teamId, input.folderId);
        folder.title = input.title.trim();
        await folder.save();
        return folder.toObject() as unknown as Record<string, unknown>;
    }

    async deleteFolder(input: {
        teamId: string;
        folderId: string;
    }): Promise<void> {
        await this.deleteFolderTree(input.teamId, input.folderId);
    }

    async listScripts(input: {
        teamId: string;
        page?: number;
        limit?: number;
        search?: string;
        folderId?: string | null;
    }): Promise<PaginatedResponse<Record<string, unknown>>> {
        const pagination = normalizePagination(input);
        const filter: Record<string, unknown> = {
            team: input.teamId,
            folder: input.folderId ?? null
        };
        const searchRegex = normalizeSearchRegex(input.search);
        if (searchRegex) {
            filter.title = searchRegex;
        }

        const [scripts, total] = await Promise.all([
            LammpsScriptModel.find(filter)
                .populate('createdBy', 'firstName lastName email')
                .populate('lastEditedBy', 'firstName lastName email')
                .populate('container', 'name status teamClusterId storageClusterId')
                .sort({ updatedAt: -1 })
                .skip((pagination.page - 1) * pagination.limit)
                .limit(pagination.limit)
                .lean()
                .exec(),
            LammpsScriptModel.countDocuments(filter).exec()
        ]);

        return buildPaginatedResponse(scripts, total, pagination);
    }

    async createScript(input: {
        teamId: string;
        userId: string;
        title: string;
        containerId: string;
        folderId?: string | null;
    }): Promise<Record<string, unknown>> {
        const title = input.title.trim();
        if (title.length === 0) {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Script title is required');
        }

        const container = await this.requireContainer(input.teamId, input.containerId);
        if (container.status !== LammpsContainerStatus.Ready || !container.workspaceContainerId) {
            throw ApplicationError.conflict(
                'LAMMPS_CONTAINER_NOT_READY',
                'The selected LAMMPS container is not ready yet'
            );
        }

        if (input.folderId) {
            await this.requireFolder(input.teamId, input.folderId);
        }

        const scriptId = new mongoose.Types.ObjectId();
        const rootPath = path.posix.join(container.workspaceRootPath || '/workspace/scripts', String(scriptId));
        const entryFilePath = path.posix.join(rootPath, DEFAULT_ENTRY_FILE_NAME);

        await this.lammpsRuntimeService.createDirectory(String(container.teamClusterId), {
            workspaceContainerId: container.workspaceContainerId,
            targetPath: rootPath
        });
        await this.lammpsRuntimeService.writeFile(String(container.teamClusterId), {
            workspaceContainerId: container.workspaceContainerId,
            targetPath: entryFilePath,
            content: '# LAMMPS input script\n'
        });

        await LammpsScriptModel.create({
            _id: scriptId,
            team: asObjectId(input.teamId),
            title,
            mpiRanks: DEFAULT_LAMMPS_MPI_RANK_COUNT,
            openmpThreads: DEFAULT_LAMMPS_OPENMP_THREAD_COUNT,
            folder: input.folderId ? asObjectId(input.folderId) : null,
            container: container._id,
            rootPath,
            entryFilePath,
            createdBy: asObjectId(input.userId),
            lastEditedBy: asObjectId(input.userId)
        });

        return this.getScript({
            teamId: input.teamId,
            scriptId: String(scriptId)
        });
    }

    async getScript(input: {
        teamId: string;
        scriptId: string;
    }): Promise<Record<string, unknown>> {
        assertObjectId(input.scriptId, 'Script id');
        const script = await LammpsScriptModel.findOne({
            _id: input.scriptId,
            team: input.teamId
        })
            .populate('createdBy', 'firstName lastName email')
            .populate('lastEditedBy', 'firstName lastName email')
            .populate('container')
            .lean()
            .exec();

        if (!script) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LAMMPS script not found');
        }

        return script;
    }

    async updateScript(input: {
        teamId: string;
        scriptId: string;
        title?: string;
        mpiRanks?: number;
        openmpThreads?: number;
        threads?: number;
    }): Promise<Record<string, unknown>> {
        const script = await this.requireScript(input.teamId, input.scriptId);
        const hasTitleUpdate = typeof input.title === 'string';
        const hasMpiUpdate = typeof input.mpiRanks !== 'undefined' || typeof input.threads !== 'undefined';
        const hasOpenmpUpdate = typeof input.openmpThreads !== 'undefined';

        if (!hasTitleUpdate && !hasMpiUpdate && !hasOpenmpUpdate) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'At least one script field must be provided'
            );
        }

        if (hasTitleUpdate) {
            const title = input.title?.trim() ?? '';
            if (title.length === 0) {
                throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Script title is required');
            }

            script.title = title;
        }

        if (hasMpiUpdate || hasOpenmpUpdate) {
            const container = await this.requireContainer(input.teamId, String(script.container));
            const currentParallelism = resolveScriptParallelism(script as LammpsScriptDocument & { threads?: number });
            const mpiRanks = normalizePositiveInteger(
                typeof input.mpiRanks === 'number' ? input.mpiRanks : input.threads,
                'MPI ranks',
                currentParallelism.mpiRanks
            );
            const openmpThreads = normalizePositiveInteger(
                input.openmpThreads,
                'OpenMP threads',
                currentParallelism.openmpThreads
            );

            await this.validateRequestedParallelism(String(container.teamClusterId), mpiRanks, openmpThreads);
            script.mpiRanks = mpiRanks;
            script.openmpThreads = openmpThreads;
        }

        await script.save();
        await LammpsScriptModel.collection.updateOne(
            { _id: script._id },
            { $unset: { threads: '' } }
        );

        return this.getScript({
            teamId: input.teamId,
            scriptId: input.scriptId
        });
    }

    async moveScript(input: {
        teamId: string;
        scriptId: string;
        folderId?: string | null;
    }): Promise<Record<string, unknown>> {
        const script = await this.requireScript(input.teamId, input.scriptId);
        if (input.folderId) {
            await this.requireFolder(input.teamId, input.folderId);
        }

        script.folder = input.folderId ? asObjectId(input.folderId) : null;
        await script.save();
        return this.getScript({
            teamId: input.teamId,
            scriptId: input.scriptId
        });
    }

    async deleteScript(input: {
        teamId: string;
        scriptId: string;
    }): Promise<void> {
        const { script, container } = await this.requireScriptContext(input.teamId, input.scriptId);
        const executions = await LammpsExecutionModel.find({
            team: input.teamId,
            script: script._id
        }).exec();

        for (const execution of executions) {
            await this.deleteExecutionByDocument(execution);
        }

        await this.lammpsRuntimeService.deletePath(String(container.teamClusterId), {
            workspaceContainerId: container.workspaceContainerId!,
            targetPath: script.rootPath
        });

        await LammpsScriptModel.deleteOne({ _id: script._id }).exec();
    }

    async listRunClusters(input: {
        teamId: string;
    }): Promise<RunClusterOption[]> {
        const clusters = await TeamClusterModel.find({
            team: input.teamId,
            status: TeamClusterStatus.Connected
        })
            .sort({ name: 1 })
            .lean()
            .exec();

        return clusters
            .map((cluster) => {
                const capabilities = buildTeamClusterEffectiveCapabilities(
                    cluster.roleConfig?.effectiveRole ?? 'cluster',
                    cluster.roleConfig?.draining ?? {}
                );

                return {
                    _id: String(cluster._id),
                    name: cluster.name,
                    status: cluster.status,
                    effectiveRole: cluster.roleConfig?.effectiveRole ?? 'cluster',
                    acceptsComputeJobs: capabilities.acceptsComputeJobs,
                    acceptsStorageWrites: capabilities.acceptsStorageWrites
                };
            })
            .filter((cluster) => cluster.acceptsComputeJobs);
    }

    async listScriptFiles(input: {
        teamId: string;
        scriptId: string;
    }): Promise<ScriptFileEntry[]> {
        const { script, container } = await this.requireScriptContext(input.teamId, input.scriptId);
        return this.collectScriptFiles(container, script, script.rootPath);
    }

    async readScriptFile(input: {
        teamId: string;
        scriptId: string;
        relativePath: string;
    }): Promise<{ contents: string }> {
        const { script, container } = await this.requireScriptContext(input.teamId, input.scriptId);
        const targetPath = this.resolveProjectPath(script, input.relativePath);

        return this.lammpsRuntimeService.readFile(String(container.teamClusterId), {
            workspaceContainerId: container.workspaceContainerId!,
            targetPath
        });
    }

    async writeScriptFile(input: {
        teamId: string;
        scriptId: string;
        relativePath: string;
        content: string;
        userId?: string;
    }): Promise<void> {
        const { script, container } = await this.requireScriptContext(input.teamId, input.scriptId);
        const targetPath = this.resolveProjectPath(script, input.relativePath);

        await this.lammpsRuntimeService.writeFile(String(container.teamClusterId), {
            workspaceContainerId: container.workspaceContainerId!,
            targetPath,
            content: input.content
        });

        if (input.userId) {
            script.lastEditedBy = asObjectId(input.userId);
            await script.save();
        }
    }

    async createScriptEntry(input: {
        teamId: string;
        scriptId: string;
        relativePath: string;
        kind: 'file' | 'directory';
        content?: string;
        userId?: string;
    }): Promise<void> {
        const { script, container } = await this.requireScriptContext(input.teamId, input.scriptId);
        const targetPath = this.resolveProjectPath(script, input.relativePath);

        if (input.kind === 'directory') {
            await this.lammpsRuntimeService.createDirectory(String(container.teamClusterId), {
                workspaceContainerId: container.workspaceContainerId!,
                targetPath
            });
        } else if (typeof input.content === 'string') {
            await this.lammpsRuntimeService.writeFile(String(container.teamClusterId), {
                workspaceContainerId: container.workspaceContainerId!,
                targetPath,
                content: input.content
            });
        } else {
            await this.lammpsRuntimeService.createFile(String(container.teamClusterId), {
                workspaceContainerId: container.workspaceContainerId!,
                targetPath
            });
        }

        if (input.userId) {
            script.lastEditedBy = asObjectId(input.userId);
            await script.save();
        }
    }

    async moveScriptEntry(input: {
        teamId: string;
        scriptId: string;
        sourcePath: string;
        destinationPath: string;
        userId?: string;
    }): Promise<void> {
        const { script, container } = await this.requireScriptContext(input.teamId, input.scriptId);
        const sourceAbsolutePath = this.resolveProjectPath(script, input.sourcePath);
        const destinationAbsolutePath = this.resolveProjectPath(script, input.destinationPath);

        await this.lammpsRuntimeService.movePath(String(container.teamClusterId), {
            workspaceContainerId: container.workspaceContainerId!,
            targetPath: sourceAbsolutePath,
            destinationPath: destinationAbsolutePath
        });

        if (script.entryFilePath === sourceAbsolutePath) {
            script.entryFilePath = destinationAbsolutePath;
        }

        if (input.userId) {
            script.lastEditedBy = asObjectId(input.userId);
        }
        await script.save();
    }

    async deleteScriptEntry(input: {
        teamId: string;
        scriptId: string;
        relativePath: string;
        userId?: string;
    }): Promise<void> {
        const { script, container } = await this.requireScriptContext(input.teamId, input.scriptId);
        const targetPath = this.resolveProjectPath(script, input.relativePath);

        if (targetPath === script.rootPath) {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Project root cannot be deleted');
        }

        if (script.entryFilePath === targetPath) {
            throw ApplicationError.conflict(
                'LAMMPS_ENTRY_FILE_DELETE_FORBIDDEN',
                'The current entry file cannot be deleted'
            );
        }

        await this.lammpsRuntimeService.deletePath(String(container.teamClusterId), {
            workspaceContainerId: container.workspaceContainerId!,
            targetPath
        });

        if (input.userId) {
            script.lastEditedBy = asObjectId(input.userId);
            await script.save();
        }
    }

    async uploadScriptFiles(input: {
        teamId: string;
        scriptId: string;
        destinationPath?: string;
        files: Array<{ originalname: string; buffer: Buffer }>;
        userId?: string;
    }): Promise<void> {
        const { script, container } = await this.requireScriptContext(input.teamId, input.scriptId);
        const destinationRelativePath = normalizeRelativePath(input.destinationPath || '', {
            allowEmpty: true,
            label: 'Destination path'
        });
        const destinationAbsolutePath = destinationRelativePath
            ? this.resolveProjectPath(script, destinationRelativePath)
            : script.rootPath;

        for (const file of input.files) {
            const safeFileName = path.posix.basename(file.originalname || 'upload.dat');
            const targetPath = path.posix.join(destinationAbsolutePath, safeFileName);

            await this.lammpsRuntimeService.writeFileBase64(String(container.teamClusterId), {
                workspaceContainerId: container.workspaceContainerId!,
                targetPath,
                contentBase64: file.buffer.toString('base64')
            });
        }

        if (input.userId) {
            script.lastEditedBy = asObjectId(input.userId);
            await script.save();
        }
    }

    async getWorkspace(input: {
        teamId: string;
        scriptId: string;
        selectedExecutionId?: string;
    }): Promise<Record<string, unknown>> {
        const [script, files, executions, runClusters] = await Promise.all([
            this.getScript({ teamId: input.teamId, scriptId: input.scriptId }),
            this.listScriptFiles({ teamId: input.teamId, scriptId: input.scriptId }),
            this.listScriptExecutions({ teamId: input.teamId, scriptId: input.scriptId }),
            this.listRunClusters({ teamId: input.teamId })
        ]);

        const selectedExecution = input.selectedExecutionId
            ? await this.getExecution({ teamId: input.teamId, executionId: input.selectedExecutionId }).catch(() => null)
            : executions[0] ?? null;
        const dumps = selectedExecution
            ? await this.listExecutionDumps({
                teamId: input.teamId,
                executionId: String(selectedExecution._id)
            })
            : [];

        return {
            script,
            files,
            executions,
            selectedExecution,
            dumps,
            availableRunClusters: runClusters
        };
    }

    async listScriptExecutions(input: {
        teamId: string;
        scriptId: string;
    }): Promise<Record<string, unknown>[]> {
        assertObjectId(input.scriptId, 'Script id');
        return LammpsExecutionModel.find({
            team: input.teamId,
            script: input.scriptId
        })
            .populate('requestedBy', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .lean()
            .exec() as Promise<Record<string, unknown>[]>;
    }

    async listExecutions(input: {
        teamId: string;
        page?: number;
        limit?: number;
        search?: string;
    }): Promise<PaginatedResponse<Record<string, unknown>>> {
        const pagination = normalizePagination(input);
        const searchRegex = normalizeSearchRegex(input.search);
        const filter: Record<string, unknown> = { team: input.teamId };

        if (searchRegex) {
            const matchingScripts = await LammpsScriptModel.find({
                team: input.teamId,
                title: searchRegex
            }).select('_id').lean().exec();

            const scriptIds = matchingScripts.map((script) => script._id);
            if (scriptIds.length === 0) {
                return buildPaginatedResponse([], 0, pagination);
            }

            filter.script = { $in: scriptIds };
        }

        const [executions, total] = await Promise.all([
            LammpsExecutionModel.find(filter)
                .populate('script', 'title')
                .populate('requestedBy', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .skip((pagination.page - 1) * pagination.limit)
                .limit(pagination.limit)
                .lean()
                .exec(),
            LammpsExecutionModel.countDocuments(filter).exec()
        ]);

        return buildPaginatedResponse(executions, total, pagination);
    }

    async getExecution(input: {
        teamId: string;
        executionId: string;
    }): Promise<Record<string, unknown>> {
        assertObjectId(input.executionId, 'Execution id');
        const execution = await LammpsExecutionModel.findOne({
            _id: input.executionId,
            team: input.teamId
        })
            .populate('script', 'title')
            .populate('container', 'name status')
            .populate('requestedBy', 'firstName lastName email')
            .lean()
            .exec();

        if (!execution) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LAMMPS execution not found');
        }

        return execution;
    }

    async startExecution(input: {
        teamId: string;
        scriptId: string;
        userId: string;
        requestedTeamClusterId?: string;
    }): Promise<Record<string, unknown>> {
        const { script, container } = await this.requireScriptContext(input.teamId, input.scriptId);
        if (!container.imageTag || !container.workspaceContainerId) {
            throw ApplicationError.conflict(
                'LAMMPS_CONTAINER_IMAGE_MISSING',
                'The selected LAMMPS container is not fully provisioned yet'
            );
        }

        const computeClusterId = input.requestedTeamClusterId
            ? await this.teamClusterSelectionService.resolveComputeClusterId(
                input.teamId,
                input.requestedTeamClusterId,
                String(container.storageClusterId)
            )
            : String(container.teamClusterId);

        if (computeClusterId !== String(container.teamClusterId)) {
            throw ApplicationError.conflict(
                'LAMMPS_REMOTE_COMPUTE_NOT_SUPPORTED',
                'This script is currently bound to the container cluster filesystem and must run there'
            );
        }

        const parallelism = resolveScriptParallelism(script as LammpsScriptDocument & { threads?: number });
        await this.validateRequestedParallelism(
            computeClusterId,
            parallelism.mpiRanks,
            parallelism.openmpThreads
        );

        const execution = await LammpsExecutionModel.create({
            team: asObjectId(input.teamId),
            script: script._id,
            container: container._id,
            requestedBy: asObjectId(input.userId),
            computeClusterId: asObjectId(computeClusterId),
            storageClusterId: container.storageClusterId,
            stagedTrajectoryId: new mongoose.Types.ObjectId().toString(),
            status: LammpsExecutionStatus.Pending,
            terminalBuffer: '',
            dumpCount: 0
        });

        const runtimeResult = await this.lammpsRuntimeService.startRun(computeClusterId, {
            executionId: String(execution._id),
            scriptId: String(script._id),
            workspaceContainerId: container.workspaceContainerId,
            projectRootPath: script.rootPath,
            entryFilePath: script.entryFilePath,
            imageTag: buildHybridRuntimeImageTag(String(container._id)),
            packages: container.packages,
            stagedTrajectoryId: execution.stagedTrajectoryId,
            storageClusterId: String(container.storageClusterId),
            mpiRanks: parallelism.mpiRanks,
            openmpThreads: parallelism.openmpThreads
        });

        execution.runtimeRunId = runtimeResult.runtimeRunId;
        execution.status = LammpsExecutionStatus.Starting;
        execution.startedAt = new Date();
        await execution.save();

        return this.getExecution({
            teamId: input.teamId,
            executionId: String(execution._id)
        });
    }

    async stopExecution(input: {
        teamId: string;
        executionId: string;
    }): Promise<void> {
        const execution = await this.requireExecution(input.teamId, input.executionId);
        await this.lammpsRuntimeService.stopRun(String(execution.computeClusterId), {
            executionId: String(execution._id)
        });
    }

    async killExecution(input: {
        teamId: string;
        executionId: string;
    }): Promise<void> {
        const execution = await this.requireExecution(input.teamId, input.executionId);
        await this.lammpsRuntimeService.killRun(String(execution.computeClusterId), {
            executionId: String(execution._id)
        });
    }

    async listExecutionDumps(input: {
        teamId: string;
        executionId: string;
    }): Promise<Record<string, unknown>[]> {
        assertObjectId(input.executionId, 'Execution id');
        return LammpsDumpModel.find({
            team: input.teamId,
            execution: input.executionId
        })
            .sort({ timestep: 1 })
            .lean()
            .exec() as Promise<Record<string, unknown>[]>;
    }

    async getExecutionGlbStream(input: {
        teamId: string;
        executionId: string;
        timestep: number;
    }) {
        const execution = await this.requireExecution(input.teamId, input.executionId);
        const objectName = buildTrajectoryGlbObjectName(execution.stagedTrajectoryId, input.timestep);
        return getClusterGlbStream(
            this.objectGatewayClient,
            String(execution.storageClusterId),
            objectName
        );
    }

    async downloadExecutionDump(input: {
        teamId: string;
        executionId: string;
        dumpId: string;
    }): Promise<{ stream: NodeJS.ReadableStream; fileName: string }> {
        await this.requireExecution(input.teamId, input.executionId);
        const dump = await this.requireDump(input.teamId, input.executionId, input.dumpId);

        if (dump.status !== LammpsDumpStatus.Ready) {
            throw ApplicationError.conflict(
                'LAMMPS_DUMP_NOT_READY',
                'This dump is not ready to download yet'
            );
        }

        const response = await this.objectGatewayClient.getStream(
            String(dump.storageClusterId),
            SYS_BUCKETS.DUMPS,
            dump.dumpObjectKey
        );

        const stream = isZstdObjectName(dump.dumpObjectKey)
            ? createZstdDecompressionStream(response.stream).stream
            : response.stream;

        return {
            stream,
            fileName: sanitizeDownloadName(`timestep-${dump.timestep}-${dump.fileName}`, 'dump.lammpstrj')
        };
    }

    async importExecutionAsTrajectory(input: {
        teamId: string;
        executionId: string;
        userId: string;
        name: string;
    }): Promise<Record<string, unknown>> {
        const execution = await this.requireExecution(input.teamId, input.executionId);
        if (execution.status !== LammpsExecutionStatus.Completed) {
            throw ApplicationError.conflict(
                'LAMMPS_EXECUTION_NOT_COMPLETED',
                'Only completed executions can be imported as trajectories'
            );
        }

        if (execution.importedTrajectoryId) {
            const existingTrajectory = await TrajectoryModel.findById(execution.importedTrajectoryId).lean().exec();
            if (existingTrajectory) {
                return existingTrajectory;
            }
        }

        const trajectoryId = execution.stagedTrajectoryId;
        const dumps = await LammpsDumpModel.find({
            execution: execution._id
        })
            .sort({ timestep: 1 })
            .lean()
            .exec();

        if (dumps.length === 0) {
            throw ApplicationError.conflict(
                'LAMMPS_EXECUTION_HAS_NO_DUMPS',
                'This execution did not produce any dumps to import'
            );
        }

        const existingTrajectory = await TrajectoryModel.findById(trajectoryId).exec();
        if (existingTrajectory) {
            execution.importedTrajectoryId = existingTrajectory._id;
            await execution.save();
            return existingTrajectory.toObject() as unknown as Record<string, unknown>;
        }

        const persistedFrames = [] as Array<{
            timestep: number;
            natoms: number;
            simulationCell: mongoose.Types.ObjectId;
        }>;
        let totalSize = 0;

        for (const dump of dumps) {
            const simulationCell = await SimulationCellModel.create({
                ...(dump.simulationCell || {}),
                team: execution.team,
                trajectory: asObjectId(trajectoryId),
                timestep: dump.timestep
            });

            persistedFrames.push({
                timestep: dump.timestep,
                natoms: dump.natoms || 0,
                simulationCell: simulationCell._id
            });
            totalSize += dump.sizeBytes || 0;
        }

        const trajectory = await TrajectoryModel.create({
            _id: asObjectId(trajectoryId),
            name: input.name.trim(),
            team: execution.team,
            folder: null,
            storageClusterId: execution.storageClusterId,
            createdBy: asObjectId(input.userId),
            status: TrajectoryStatus.Completed,
            isPublic: true,
            frames: persistedFrames,
            rasterSceneViews: 0,
            hasPreview: persistedFrames.length > 0,
            stats: {
                totalFiles: persistedFrames.length,
                totalSize
            }
        });

        await this.storagePlacementService.ensurePlacement('trajectory', trajectoryId);

        execution.importedTrajectoryId = trajectory._id;
        await execution.save();

        return trajectory.toObject() as unknown as Record<string, unknown>;
    }

    async deleteExecution(input: {
        teamId: string;
        executionId: string;
    }): Promise<void> {
        const execution = await this.requireExecution(input.teamId, input.executionId);

        if (!isTerminalExecutionStatus(execution.status)) {
            throw ApplicationError.conflict(
                'LAMMPS_EXECUTION_DELETE_FORBIDDEN',
                'Stop the execution before deleting it'
            );
        }

        await this.deleteExecutionByDocument(execution);
    }

    async deleteExecutionDump(input: {
        teamId: string;
        executionId: string;
        dumpId: string;
    }): Promise<void> {
        const execution = await this.requireExecution(input.teamId, input.executionId);
        const dump = await this.requireDump(input.teamId, input.executionId, input.dumpId);

        await Promise.all([
            this.objectGatewayClient.deleteObject(
                String(dump.storageClusterId),
                SYS_BUCKETS.DUMPS,
                dump.dumpObjectKey
            ),
            dump.modelObjectKey
                ? this.objectGatewayClient.deleteObject(
                    String(dump.storageClusterId),
                    SYS_BUCKETS.MODELS,
                    dump.modelObjectKey
                )
                : Promise.resolve()
        ]);

        await LammpsDumpModel.deleteOne({
            _id: dump._id,
            execution: execution._id
        }).exec();

        const remainingDumps = await LammpsDumpModel.find({
            execution: execution._id
        })
            .sort({ timestep: -1 })
            .lean()
            .exec();

        execution.dumpCount = remainingDumps.length;
        execution.lastTimestep = remainingDumps[0]?.timestep;
        await execution.save();
    }

    private async collectScriptFiles(
        container: LammpsContainerDocument,
        script: LammpsScriptDocument,
        directoryPath: string
    ): Promise<ScriptFileEntry[]> {
        const entries = await this.lammpsRuntimeService.listFilesystem(String(container.teamClusterId), {
            workspaceContainerId: container.workspaceContainerId!,
            targetPath: directoryPath
        });
        const fileEntries = [] as ScriptFileEntry[];

        for (const entry of entries) {
            const entryName = typeof entry.name === 'string' ? entry.name : '';
            if (!entryName) {
                continue;
            }

            const absolutePath = path.posix.join(directoryPath, entryName);
            const relativePath = path.posix.relative(script.rootPath, absolutePath);
            const normalizedRelativePath = relativePath === '.' ? '' : relativePath;

            if (!normalizedRelativePath) {
                continue;
            }

            const kind = entry.isDirectory ? 'directory' : 'file';
            fileEntries.push({
                _id: normalizedRelativePath,
                kind,
                name: entryName,
                path: absolutePath,
                relativePath: normalizedRelativePath,
                parentPath: path.posix.dirname(normalizedRelativePath) === '.'
                    ? null
                    : path.posix.dirname(normalizedRelativePath),
                size: parseNumericSize(entry.size),
                permissions: typeof entry.permissions === 'string' ? entry.permissions : undefined,
                owner: typeof entry.owner === 'string' ? entry.owner : undefined,
                group: typeof entry.group === 'string' ? entry.group : undefined,
                date: typeof entry.date === 'string' ? entry.date : undefined
            });

            if (entry.isDirectory) {
                const nestedEntries = await this.collectScriptFiles(container, script, absolutePath);
                fileEntries.push(...nestedEntries);
            }
        }

        return fileEntries.sort((left, right) => {
            if (left.kind !== right.kind) {
                return left.kind === 'directory' ? -1 : 1;
            }

            return left.relativePath.localeCompare(right.relativePath);
        });
    }

    private resolveProjectPath(script: LammpsScriptDocument, relativePath: string): string {
        const normalizedRelativePath = normalizeRelativePath(relativePath, {
            allowEmpty: true,
            label: 'File path'
        });

        if (!normalizedRelativePath) {
            return script.rootPath;
        }

        return path.posix.join(script.rootPath, normalizedRelativePath);
    }

    private async deleteFolderTree(teamId: string, folderId: string): Promise<void> {
        const childFolders = await CatalogFolderModel.find({
            team: teamId,
            kind: CatalogFolderKind.Lammps,
            parent: folderId
        }).lean().exec();

        for (const childFolder of childFolders) {
            await this.deleteFolderTree(teamId, String(childFolder._id));
        }

        const scripts = await LammpsScriptModel.find({
            team: teamId,
            folder: folderId
        }).lean().exec();

        for (const script of scripts) {
            await this.deleteScript({
                teamId,
                scriptId: String(script._id)
            });
        }

        await CatalogFolderModel.deleteOne({
            _id: folderId,
            team: teamId,
            kind: CatalogFolderKind.Lammps
        }).exec();
    }

    private async deleteExecutionByDocument(execution: LammpsExecutionDocument): Promise<void> {
        const dumps = await LammpsDumpModel.find({
            execution: execution._id
        }).lean().exec();

        if (!execution.importedTrajectoryId) {
            const prefix = buildExecutionStoragePrefix(execution.stagedTrajectoryId);
            await Promise.all([
                this.objectGatewayClient.deleteByPrefix(
                    String(execution.storageClusterId),
                    SYS_BUCKETS.DUMPS,
                    prefix
                ),
                this.objectGatewayClient.deleteByPrefix(
                    String(execution.storageClusterId),
                    SYS_BUCKETS.MODELS,
                    prefix
                )
            ]);
        }

        if (dumps.length > 0) {
            await LammpsDumpModel.deleteMany({
                execution: execution._id
            }).exec();
        }

        await LammpsExecutionModel.deleteOne({ _id: execution._id }).exec();
    }

    private async requireContainer(teamId: string, containerId: string): Promise<LammpsContainerDocument> {
        assertObjectId(containerId, 'Container id');
        const container = await LammpsContainerModel.findOne({
            _id: containerId,
            team: teamId
        }).exec();

        if (!container) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LAMMPS container not found');
        }

        return container;
    }

    private async requireFolder(teamId: string, folderId: string) {
        assertObjectId(folderId, 'Folder id');
        const folder = await CatalogFolderModel.findOne({
            _id: folderId,
            team: teamId,
            kind: CatalogFolderKind.Lammps
        }).exec();

        if (!folder) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LAMMPS folder not found');
        }

        return folder;
    }

    private async requireScript(teamId: string, scriptId: string): Promise<LammpsScriptDocument> {
        assertObjectId(scriptId, 'Script id');
        const script = await LammpsScriptModel.findOne({
            _id: scriptId,
            team: teamId
        }).exec();

        if (!script) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LAMMPS script not found');
        }

        return script;
    }

    private async requireExecution(teamId: string, executionId: string): Promise<LammpsExecutionDocument> {
        assertObjectId(executionId, 'Execution id');
        const execution = await LammpsExecutionModel.findOne({
            _id: executionId,
            team: teamId
        }).exec();

        if (!execution) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LAMMPS execution not found');
        }

        return execution;
    }

    private async requireDump(teamId: string, executionId: string, dumpId: string): Promise<LammpsDumpDocument> {
        assertObjectId(dumpId, 'Dump id');
        const dump = await LammpsDumpModel.findOne({
            _id: dumpId,
            team: teamId,
            execution: executionId
        }).exec();

        if (!dump) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LAMMPS dump not found');
        }

        return dump;
    }

    private async requireScriptContext(
        teamId: string,
        scriptId: string
    ): Promise<{ script: LammpsScriptDocument; container: LammpsContainerDocument }> {
        const script = await this.requireScript(teamId, scriptId);
        const container = await this.requireContainer(teamId, String(script.container));

        if (!container.workspaceContainerId) {
            throw ApplicationError.conflict(
                'LAMMPS_CONTAINER_WORKSPACE_MISSING',
                'The script container does not have a workspace container yet'
            );
        }

        return { script, container };
    }
}
