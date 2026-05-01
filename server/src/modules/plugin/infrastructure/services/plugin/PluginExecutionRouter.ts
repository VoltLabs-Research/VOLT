import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import type Analysis from '@modules/analysis/domain/entities/Analysis';
import type Plugin from '@modules/plugin/domain/entities/plugin/Plugin';
import type {
    IPluginExecutionRouter,
    PluginReferenceExecutionRequest,
    RoutePluginExecutionInput
} from '@modules/plugin/domain/port/plugin/IPluginExecutionRouter';
import DaemonAnalysisCompletionService from '@modules/cluster/infrastructure/services/DaemonAnalysisCompletionService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import {
    ChannelCommands,
    VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID
} from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { isStorageObjectNotFoundError } from '@shared/infrastructure/utilities/storage-errors';
import type IORedis from 'ioredis';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { inject } from 'tsyringe';

const gzipAsync = promisify(zlib.gzip);

const DISPATCH_SECTION_CACHE_TTL_SECONDS = 600;

interface DaemonPluginSyncResponse {
    synced: boolean;
    objectKey: string;
};

interface DaemonAnalysisStartResponse {
    queued: boolean;
    totalJobs: number;
    jobs: DaemonAnalysisJob[];
};

interface DaemonAnalysisJob {
    jobId: string;
    name: string;
    teamId: string;
    timestep: number;
    trajectoryId: string;
    analysisId: string;
    queueType: string;
};

interface WorkflowSerializable {
    nodes: Array<{
        id: string;
        type: string;
        position: { x: number; y: number; };
        data: Record<string, unknown>;
    }>;
    edges: Array<{
        id?: string;
        source: string;
        target: string;
        sourceHandle?: string;
        targetHandle?: string;
    }>;
};

interface DaemonAnalysisPayload {
    _id: string;
    plugin: string;
    pluginDisplayName: string;
    computeClusterId?: string;
    storageClusterId?: string;
    config: Record<string, unknown>;
    trajectory: string;
    createdBy: string;
    totalFrames?: number;
    completedFrames?: number;
    startedAt?: Date;
    finishedAt?: Date;
    team: string;
    status: string;
    createdAt?: Date;
    updatedAt?: Date;
};

const serializeAnalysis = (analysis: Analysis): DaemonAnalysisPayload => {
    return {
        _id: analysis._id,
        plugin: analysis.props.plugin,
        pluginDisplayName: analysis.props.pluginDisplayName,
        computeClusterId: analysis.props.computeClusterId,
        storageClusterId: analysis.props.storageClusterId,
        config: analysis.props.config,
        trajectory: analysis.props.trajectory,
        createdBy: analysis.props.createdBy,
        totalFrames: analysis.props.totalFrames,
        completedFrames: analysis.props.completedFrames,
        startedAt: analysis.props.startedAt,
        finishedAt: analysis.props.finishedAt,
        team: analysis.props.team,
        status: analysis.props.status,
        createdAt: analysis.props.createdAt,
        updatedAt: analysis.props.updatedAt
    };
};

interface NestedPluginDefinition {
    pluginId: string;
    workflow: WorkflowSerializable;
};

interface TrajectoryFramePayload {
    timestep: number;
    natoms: number;
    simulationCell: string;
};

interface PluginDispatchPayload extends Record<string, unknown> {
    analysis: DaemonAnalysisPayload;
    analysisId: string;
    pluginId: string;
    pluginDisplayName: string;
    teamId: string;
    teamClusterId: string;
    trajectoryId: string;
    trajectoryFrames?: TrajectoryFramePayload[];
    trajectoryFramesCompressed?: string;
    workflow?: WorkflowSerializable;
    workflowCompressed?: string;
    nestedPlugins?: NestedPluginDefinition[];
    nestedPluginsCompressed?: string;
    pluginReferenceExecutions?: PluginReferenceExecutionRequest[];
    pluginReferenceExecutionsCompressed?: string;
    config: Record<string, unknown>;
    selectedFrameOnly?: boolean;
    selectedTimesteps?: number[];
    timestep?: number;
};

interface DispatchCleanupSummary {
    duplicateDependencyCount: number;
    duplicateNestedPluginCount: number;
    duplicatePluginReferenceExecutionCount: number;
    uniquePluginSyncCount: number;
    payloadBytes: number;
};

const COMPRESSIBLE_ANALYSIS_SECTION_THRESHOLD_BYTES = 1024;

interface EncodedDispatchSection<T> {
    rawBytes: number;
    storedBytes: number;
    compressedValue?: string;
    rawValue?: T;
};

const buildNestedPluginDefinition = (plugin: Plugin): NestedPluginDefinition => {
    return {
        pluginId: plugin.id,
        workflow: plugin.props.workflow.props as unknown as WorkflowSerializable
    };
};

const createPluginReferenceExecutionKey = (request: PluginReferenceExecutionRequest): string => {
    return JSON.stringify({
        referencePath: request.referencePath,
        pluginId: request.pluginId,
        config: request.config
    });
};

const dedupePluginsById = (plugins: Plugin[]): Plugin[] => {
    const dedupedPlugins = new Map<string, Plugin>();

    for (const plugin of plugins) {
        if (dedupedPlugins.has(plugin.id)) {
            continue;
        }

        dedupedPlugins.set(plugin.id, plugin);
    }

    return Array.from(dedupedPlugins.values());
};

const dedupePluginReferenceExecutions = (
    pluginReferenceExecutions: PluginReferenceExecutionRequest[]
): PluginReferenceExecutionRequest[] => {
    const dedupedPluginReferenceExecutions = new Map<string, PluginReferenceExecutionRequest>();

    for (const pluginReferenceExecution of pluginReferenceExecutions) {
        const key = createPluginReferenceExecutionKey(pluginReferenceExecution);
        if (dedupedPluginReferenceExecutions.has(key)) {
            continue;
        }

        dedupedPluginReferenceExecutions.set(key, {
            referencePath: pluginReferenceExecution.referencePath,
            pluginId: pluginReferenceExecution.pluginId,
            config: pluginReferenceExecution.config
        });
    }

    return Array.from(dedupedPluginReferenceExecutions.values());
};

const encodeDispatchSection = async <T>(value: T): Promise<EncodedDispatchSection<T>> => {
    // Why: single serialization pass — the Buffer carries both the byte count
    // and the raw bytes fed to gzip, eliminating `JSON.stringify(value)` +
    // `Buffer.byteLength(stringified)` as distinct passes over the same data.
    const serializedBuffer = Buffer.from(JSON.stringify(value), 'utf8');
    const rawBytes = serializedBuffer.byteLength;

    if (rawBytes < COMPRESSIBLE_ANALYSIS_SECTION_THRESHOLD_BYTES) {
        return {
            rawBytes,
            storedBytes: rawBytes,
            rawValue: value
        };
    }

    const compressed = await gzipAsync(serializedBuffer);
    const compressedValue = compressed.toString('base64');
    return {
        rawBytes,
        storedBytes: compressedValue.length,
        compressedValue
    };
};

@Singleton()
export default class PluginExecutionRouter implements IPluginExecutionRouter {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        
        private readonly daemonAnalysisCompletionService: DaemonAnalysisCompletionService,

        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis
    ){}

    private readonly inflightEncodes = new Map<string, Promise<EncodedDispatchSection<unknown>>>();
    private readonly inflightPluginSyncs = new Map<string, Promise<void>>();

    private async cachedEncode<T>(cacheKey: string, value: T): Promise<EncodedDispatchSection<T>> {
        try {
            const cached = await this.redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached) as EncodedDispatchSection<T>;
            }
        } catch (error: unknown) {
            logger.warn({ err: error, cacheKey }, '@plugin-execution-router: dispatch section cache read failed');
        }

        const existing = this.inflightEncodes.get(cacheKey) as Promise<EncodedDispatchSection<T>> | undefined;
        if (existing) return existing;

        const pending = (async () => {
            const encoded = await encodeDispatchSection(value);
            try {
                await this.redis.setex(cacheKey, DISPATCH_SECTION_CACHE_TTL_SECONDS, JSON.stringify(encoded));
            } catch (error: unknown) {
                logger.warn({ err: error, cacheKey }, '@plugin-execution-router: dispatch section cache write failed');
            }
            return encoded;
        })().finally(() => {
            this.inflightEncodes.delete(cacheKey);
        });

        this.inflightEncodes.set(cacheKey, pending as Promise<EncodedDispatchSection<unknown>>);
        return pending;
    }

    private encodeWorkflowSection(plugin: Plugin): Promise<EncodedDispatchSection<WorkflowSerializable>> {
        const revision = plugin.props.updatedAt.getTime();
        const cacheKey = `plugin-dispatch:workflow:${plugin.id}:${revision}`;
        return this.cachedEncode(cacheKey, plugin.props.workflow.props as unknown as WorkflowSerializable);
    }

    private encodeNestedPluginsSection(
        rootPluginId: string,
        deps: Plugin[],
        nestedPlugins: NestedPluginDefinition[]
    ): Promise<EncodedDispatchSection<NestedPluginDefinition[]>> {
        const revisionToken = deps
            .map((d) => `${d.id}@${d.props.updatedAt.getTime()}`)
            .sort()
            .join('|');
        const cacheKey = `plugin-dispatch:nested:${rootPluginId}:${revisionToken || 'empty'}`;
        return this.cachedEncode(cacheKey, nestedPlugins);
    }

    async route(input: RoutePluginExecutionInput): Promise<void> {
        const uniqueDependencyPlugins = dedupePluginsById(input.pluginDependencies);
        const uniquePluginsToSync = dedupePluginsById([
            input.plugin,
            ...uniqueDependencyPlugins
        ]);

        const nestedPlugins = uniqueDependencyPlugins.map(buildNestedPluginDefinition);
        const pluginReferenceExecutions = dedupePluginReferenceExecutions(input.pluginReferenceExecutions);

        const [, encodedTrajectoryFrames, encodedWorkflow, encodedNestedPlugins, encodedPluginReferenceExecutions] = await Promise.all([
            Promise.all(uniquePluginsToSync.map((dependency) => this.syncPluginBinaryIfNeeded(input.teamClusterId, dependency))),
            encodeDispatchSection(input.trajectoryFrames),
            this.encodeWorkflowSection(input.plugin),
            this.encodeNestedPluginsSection(input.plugin.id, uniqueDependencyPlugins, nestedPlugins),
            encodeDispatchSection(pluginReferenceExecutions)
        ]);
        const dispatchPayload: PluginDispatchPayload = {
            analysis: serializeAnalysis(input.analysis),
            analysisId: input.analysisId,
            pluginId: input.plugin.id,
            pluginDisplayName: input.pluginDisplayName,
            teamId: input.teamId,
            teamClusterId: input.teamClusterId,
            trajectoryId: input.trajectoryId,
            ...(encodedTrajectoryFrames.rawValue
                ? { trajectoryFrames: encodedTrajectoryFrames.rawValue }
                : { trajectoryFramesCompressed: encodedTrajectoryFrames.compressedValue }),
            ...(encodedWorkflow.rawValue
                ? { workflow: encodedWorkflow.rawValue }
                : { workflowCompressed: encodedWorkflow.compressedValue }),
            ...(encodedNestedPlugins.rawValue
                ? { nestedPlugins: encodedNestedPlugins.rawValue }
                : { nestedPluginsCompressed: encodedNestedPlugins.compressedValue }),
            ...(encodedPluginReferenceExecutions.rawValue
                ? { pluginReferenceExecutions: encodedPluginReferenceExecutions.rawValue }
                : { pluginReferenceExecutionsCompressed: encodedPluginReferenceExecutions.compressedValue }),
            config: input.config,
            selectedFrameOnly: input.selectedFrameOnly,
            selectedTimesteps: input.selectedTimesteps,
            timestep: input.timestep
        };
        const payloadBytesEstimate =
            encodedTrajectoryFrames.storedBytes
            + encodedWorkflow.storedBytes
            + encodedNestedPlugins.storedBytes
            + encodedPluginReferenceExecutions.storedBytes
            + Buffer.byteLength(JSON.stringify({
                analysisId: input.analysisId,
                pluginId: input.plugin.id,
                teamId: input.teamId,
                trajectoryId: input.trajectoryId,
                teamClusterId: input.teamClusterId,
                config: input.config,
                selectedFrameOnly: input.selectedFrameOnly,
                selectedTimesteps: input.selectedTimesteps,
                timestep: input.timestep
            }), 'utf8');
        const cleanupSummary: DispatchCleanupSummary = {
            duplicateDependencyCount: input.pluginDependencies.length - uniqueDependencyPlugins.length,
            duplicateNestedPluginCount: input.pluginDependencies.length - nestedPlugins.length,
            duplicatePluginReferenceExecutionCount: input.pluginReferenceExecutions.length - pluginReferenceExecutions.length,
            uniquePluginSyncCount: uniquePluginsToSync.length,
            payloadBytes: payloadBytesEstimate
        };
        const payloadCompressionSavingsBytes =
            (encodedTrajectoryFrames.rawBytes - encodedTrajectoryFrames.storedBytes)
            + (encodedWorkflow.rawBytes - encodedWorkflow.storedBytes)
            + (encodedNestedPlugins.rawBytes - encodedNestedPlugins.storedBytes)
            + (encodedPluginReferenceExecutions.rawBytes - encodedPluginReferenceExecutions.storedBytes);

        if (
            cleanupSummary.duplicateDependencyCount > 0
            || cleanupSummary.duplicateNestedPluginCount > 0
            || cleanupSummary.duplicatePluginReferenceExecutionCount > 0
        ) {
            logger.info(`@plugin-execution-router: deduped analysis dispatch payload analysisId=${input.analysisId} teamClusterId=${input.teamClusterId} pluginId=${input.plugin.id} payloadCompressionSavingsBytes=${payloadCompressionSavingsBytes}`);
        } else {
            logger.debug(`@plugin-execution-router: prepared analysis dispatch payload analysisId=${input.analysisId} teamClusterId=${input.teamClusterId} pluginId=${input.plugin.id} payloadBytes=${cleanupSummary.payloadBytes}`);
        }

        const response = await this.teamClusterDaemonClient.command<DaemonAnalysisStartResponse>(
            input.teamClusterId,
            ChannelCommands.AnalysisStart,
            dispatchPayload
        );

        await this.daemonAnalysisCompletionService.initializeSession(
            input.analysisId,
            response.totalJobs,
            input.teamId,
            input.trajectoryId
        );

        if (response.jobs?.length > 0) {
            await this.daemonAnalysisCompletionService.handleJobsQueued(
                response.jobs.map((job) => ({
                    ...job,
                    trajectoryName: input.trajectoryName
                })),
                input.teamId,
                input.teamClusterId
            ).catch((error) => {
                logger.warn(error, '@plugin-execution-router: failed to project queued daemon analysis jobs');
            });
        }
    }

    private async syncPluginBinaryIfNeeded(teamClusterId: string, plugin: Plugin): Promise<void> {
        const entrypointNode = plugin.props.workflow.props.nodes.find((node) => node.type === 'entrypoint');
        const entrypoint = entrypointNode?.data.entrypoint;
        const objectKey = entrypoint?.binaryObjectPath;
        if (!objectKey) {
            throw ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                `Plugin ${plugin.id} is missing an uploaded entrypoint binary`
            );
        }

        const expectedHash = entrypoint?.binaryHash ?? await this.readObjectSha256(objectKey);

        const syncKey = `${teamClusterId}:${plugin.id}:${objectKey}:${expectedHash ?? 'unknown-hash'}`;
        const existingSync = this.inflightPluginSyncs.get(syncKey);
        if (existingSync) {
            return existingSync;
        }

        const pendingSync = (async () => {
            const syncResponse = await this.teamClusterDaemonClient.command<DaemonPluginSyncResponse>(
                teamClusterId,
                ChannelCommands.PluginSync,
                {
                    pluginId: plugin.id,
                    objectKey,
                    ownerClusterId: VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
                    expectedHash
                },
                { timeoutClass: 'long-running-control-plane' }
            );

            if (!syncResponse.synced) {
                throw ApplicationError.conflict(
                    ErrorCodes.PLUGIN_EXECUTOR_BINARY_NOT_ACCESSIBLE,
                    `Plugin binary is not reachable from compute cluster: ${objectKey}`
                );
            }
        })().finally(() => {
            this.inflightPluginSyncs.delete(syncKey);
        });

        this.inflightPluginSyncs.set(syncKey, pendingSync);
        return pendingSync;
    }

    private async readObjectSha256(objectKey: string): Promise<string | undefined> {
        let objectStat;

        try {
            objectStat = await this.storageService.getStat(SYS_BUCKETS.PLUGINS, objectKey);
        } catch (error: unknown) {
            if (isStorageObjectNotFoundError(error)) {
                throw ApplicationError.conflict(
                    ErrorCodes.PLUGIN_EXECUTOR_BINARY_NOT_ACCESSIBLE,
                    `Plugin binary is missing from storage: ${objectKey}`
                );
            }

            throw new ApplicationError(
                ErrorCodes.PLUGIN_EXECUTOR_BINARY_NOT_ACCESSIBLE,
                `Failed to inspect plugin binary in storage: ${objectKey}`,
                503
            );
        }

        const directHash = objectStat['x-amz-meta-sha256'];
        return typeof directHash === 'string' && directHash.length > 0
            ? directHash
            : undefined;
    }
};
