import { SYS_BUCKETS } from '@core/config/minio';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'node:crypto';
import zlib from 'node:zlib';
import type Analysis from '@modules/analysis/domain/entities/Analysis';
import type Plugin from '@modules/plugin/domain/entities/plugin/Plugin';
import type { Readable } from 'node:stream';
import type {
    IPluginExecutionRouter,
    PluginReferenceExecutionRequest,
    RoutePluginExecutionInput
} from '@modules/plugin/domain/port/plugin/IPluginExecutionRouter';
import type DaemonAnalysisCompletionService from '@modules/team-cluster/infrastructure/services/DaemonAnalysisCompletionService';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

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
    trajectoryName?: string;
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
    teamCluster?: string;
    config: Record<string, unknown>;
    trajectory: string;
    createdBy: string;
    totalFrames?: number;
    completedFrames?: number;
    startedAt?: Date;
    finishedAt?: Date;
    team: string;
    status: string;
    trajectoryName: string;
    createdAt?: Date;
    updatedAt?: Date;
};

const serializeAnalysis = (analysis: Analysis, trajectoryName: string): DaemonAnalysisPayload => {
    return {
        _id: analysis.id,
        plugin: analysis.props.plugin,
        pluginDisplayName: analysis.props.pluginDisplayName,
        teamCluster: analysis.props.teamCluster,
        config: analysis.props.config,
        trajectory: analysis.props.trajectory,
        createdBy: analysis.props.createdBy,
        totalFrames: analysis.props.totalFrames,
        completedFrames: analysis.props.completedFrames,
        startedAt: analysis.props.startedAt,
        finishedAt: analysis.props.finishedAt,
        team: analysis.props.team,
        status: analysis.props.status,
        trajectoryName,
        createdAt: analysis.props.createdAt,
        updatedAt: analysis.props.updatedAt
    };
};

interface NestedPluginDefinition {
    pluginId: string;
    workflow: WorkflowSerializable;
};

interface DaemonPluginReferenceExecutionRequest extends PluginReferenceExecutionRequest {};

interface TrajectoryFramePayload {
    timestep: number;
    natoms: number;
    simulationCell: string;
};

interface PluginDispatchPayload {
    analysis: DaemonAnalysisPayload;
    analysisId: string;
    pluginId: string;
    pluginDisplayName: string;
    teamId: string;
    teamClusterId: string;
    trajectoryId: string;
    trajectoryName: string;
    trajectoryFrames?: TrajectoryFramePayload[];
    trajectoryFramesCompressed?: string;
    workflow?: WorkflowSerializable;
    workflowCompressed?: string;
    nestedPlugins?: NestedPluginDefinition[];
    nestedPluginsCompressed?: string;
    pluginReferenceExecutions?: DaemonPluginReferenceExecutionRequest[];
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

const DIRECT_PLUGIN_UPLOAD_THRESHOLD = 768 * 1024;
const PLUGIN_UPLOAD_CHUNK_SIZE = 512 * 1024;
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
): DaemonPluginReferenceExecutionRequest[] => {
    const dedupedPluginReferenceExecutions = new Map<string, DaemonPluginReferenceExecutionRequest>();

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

const encodeDispatchSection = <T>(value: T): EncodedDispatchSection<T> => {
    const serializedValue = JSON.stringify(value);
    const rawBytes = Buffer.byteLength(serializedValue);

    if (rawBytes < COMPRESSIBLE_ANALYSIS_SECTION_THRESHOLD_BYTES) {
        return {
            rawBytes,
            storedBytes: rawBytes,
            rawValue: value
        };
    }

    const compressedValue = zlib.gzipSync(serializedValue).toString('base64');
    return {
        rawBytes,
        storedBytes: Buffer.byteLength(compressedValue),
        compressedValue
    };
};

@injectable()
export default class PluginExecutionRouter implements IPluginExecutionRouter {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(TEAM_CLUSTER_TOKENS.DaemonAnalysisCompletionService)
        private readonly daemonAnalysisCompletionService: DaemonAnalysisCompletionService
    ){}

    async route(input: RoutePluginExecutionInput): Promise<void> {
        const uniqueDependencyPlugins = dedupePluginsById(input.pluginDependencies);
        const uniquePluginsToSync = dedupePluginsById([
            input.plugin,
            ...uniqueDependencyPlugins
        ]);
        for (const dependency of uniquePluginsToSync) {
            await this.syncPluginBinaryIfNeeded(input.teamClusterId, dependency);
        }

        const nestedPlugins = uniqueDependencyPlugins.map(buildNestedPluginDefinition);
        const pluginReferenceExecutions = dedupePluginReferenceExecutions(input.pluginReferenceExecutions);
        const encodedTrajectoryFrames = encodeDispatchSection(input.trajectoryFrames);
        const encodedWorkflow = encodeDispatchSection(input.plugin.props.workflow.props as unknown as WorkflowSerializable);
        const encodedNestedPlugins = encodeDispatchSection(nestedPlugins);
        const encodedPluginReferenceExecutions = encodeDispatchSection(pluginReferenceExecutions);
        const dispatchPayload: PluginDispatchPayload = {
            analysis: serializeAnalysis(input.analysis, input.trajectoryName),
            analysisId: input.analysisId,
            pluginId: input.plugin.id,
            pluginDisplayName: input.pluginDisplayName,
            teamId: input.teamId,
            teamClusterId: input.teamClusterId,
            trajectoryId: input.trajectoryId,
            trajectoryName: input.trajectoryName,
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
        const cleanupSummary: DispatchCleanupSummary = {
            duplicateDependencyCount: input.pluginDependencies.length - uniqueDependencyPlugins.length,
            duplicateNestedPluginCount: input.pluginDependencies.length - nestedPlugins.length,
            duplicatePluginReferenceExecutionCount: input.pluginReferenceExecutions.length - pluginReferenceExecutions.length,
            uniquePluginSyncCount: uniquePluginsToSync.length,
            payloadBytes: Buffer.byteLength(JSON.stringify(dispatchPayload))
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
            logger.info({
                action: 'plugin.analysis.dispatch.cleaned',
                analysisId: input.analysisId,
                teamClusterId: input.teamClusterId,
                pluginId: input.plugin.id,
                payloadCompressionSavingsBytes,
                ...cleanupSummary
            }, '@plugin-execution-router: deduped analysis dispatch payload');
        } else {
            logger.debug({
                action: 'plugin.analysis.dispatch.payload-size',
                analysisId: input.analysisId,
                teamClusterId: input.teamClusterId,
                pluginId: input.plugin.id,
                payloadBytes: cleanupSummary.payloadBytes,
                payloadCompressionSavingsBytes,
                uniquePluginSyncCount: cleanupSummary.uniquePluginSyncCount,
                nestedPluginCount: nestedPlugins.length,
                pluginReferenceExecutionCount: pluginReferenceExecutions.length
            }, '@plugin-execution-router: prepared analysis dispatch payload');
        }

        const response = await this.teamClusterDaemonClient.command<DaemonAnalysisStartResponse>(
            input.teamClusterId,
            TEAM_CLUSTER_DAEMON_COMMAND.analysis.start,
            dispatchPayload
        );

        await this.daemonAnalysisCompletionService.initializeSession(
            input.analysisId,
            response.totalJobs
        );

        if (response.jobs?.length > 0) {
            await this.daemonAnalysisCompletionService.handleJobsQueued(
                response.jobs,
                input.teamId
            );
        }
    }

    private async syncPluginBinaryIfNeeded(teamClusterId: string, plugin: Plugin): Promise<void> {
        const entrypointNode = plugin.props.workflow.props.nodes.find((node) => node.type === 'entrypoint');
        const objectKey = entrypointNode?.data.entrypoint?.binaryObjectPath;
        if (!objectKey) {
            return;
        }

        const syncResponse = await this.teamClusterDaemonClient.command<DaemonPluginSyncResponse>(teamClusterId, TEAM_CLUSTER_DAEMON_COMMAND.plugin.sync, {
            pluginId: plugin.id,
            objectKey
        });

        if (syncResponse.synced) {
            return;
        }

        const objectStat = await this.storageService.getStat(SYS_BUCKETS.PLUGINS, objectKey);
        const objectSize = typeof objectStat.size === 'number' && Number.isFinite(objectStat.size)
            ? objectStat.size
            : undefined;

        if (typeof objectSize === 'undefined' || objectSize < 0) {
            throw new Error(`Plugin object size is unavailable for chunked sync: ${objectKey}`);
        }

        if (objectSize > DIRECT_PLUGIN_UPLOAD_THRESHOLD) {
            await this.uploadPluginBinaryChunked(teamClusterId, objectKey, objectSize);
        } else {
            const buffer = await this.storageService.getBuffer(SYS_BUCKETS.PLUGINS, objectKey);
            await this.teamClusterDaemonClient.command(teamClusterId, TEAM_CLUSTER_DAEMON_COMMAND.object.upload, {
                bucket: SYS_BUCKETS.PLUGINS,
                objectKey,
                content: buffer.toString('base64'),
                encoding: 'base64'
            });
        }

        const finalSyncResponse = await this.teamClusterDaemonClient.command<DaemonPluginSyncResponse>(teamClusterId, TEAM_CLUSTER_DAEMON_COMMAND.plugin.sync, {
            pluginId: plugin.id,
            objectKey
        });

        if (!finalSyncResponse.synced) {
            throw new Error(`Daemon failed to confirm synced plugin binary: ${objectKey}`);
        }
    }

    private async uploadPluginBinaryChunked(teamClusterId: string, objectKey: string, totalSize: number): Promise<void> {
        const transferId = randomUUID();
        const totalChunks = Math.max(1, Math.ceil(totalSize / PLUGIN_UPLOAD_CHUNK_SIZE));
        let initialized = false;

        logger.info({
            action: 'plugin.binary.upload.chunked',
            objectKey,
            teamClusterId,
            totalChunks,
            totalSize,
            transferId
        }, '@plugin-execution-router: starting chunked plugin upload');

        try {
            await this.teamClusterDaemonClient.command(teamClusterId, TEAM_CLUSTER_DAEMON_COMMAND.object.uploadInit, {
                transferId,
                bucket: SYS_BUCKETS.PLUGINS,
                objectKey,
                totalChunks
            }, {
                timeoutClass: 'long-running-control-plane'
            });
            initialized = true;

            const objectStream = await this.storageService.getStream(SYS_BUCKETS.PLUGINS, objectKey);
            await this.uploadPluginBinaryChunks(teamClusterId, transferId, objectStream, totalChunks);

            await this.teamClusterDaemonClient.command(teamClusterId, TEAM_CLUSTER_DAEMON_COMMAND.object.uploadCommit, {
                transferId
            }, {
                timeoutClass: 'long-running-control-plane'
            });

            logger.info({
                action: 'plugin.binary.upload.chunked.completed',
                objectKey,
                teamClusterId,
                totalChunks,
                totalSize,
                transferId
            }, '@plugin-execution-router: completed chunked plugin upload');
        } catch (error) {
            if (initialized) {
                await this.teamClusterDaemonClient.command(teamClusterId, TEAM_CLUSTER_DAEMON_COMMAND.object.uploadAbort, {
                    transferId
                }, {
                    timeoutClass: 'interactive'
                }).catch((abortError) => {
                    logger.warn({
                        abortError,
                        objectKey,
                        teamClusterId,
                        transferId
                    }, '@plugin-execution-router: failed to abort chunked plugin upload');
                });
            }

            throw error;
        }
    }

    private async uploadPluginBinaryChunks(
        teamClusterId: string,
        transferId: string,
        objectStream: Readable,
        totalChunks: number
    ): Promise<void> {
        let pendingBuffer = Buffer.alloc(0);
        let chunkIndex = 0;

        const sendChunk = async (chunk: Buffer): Promise<void> => {
            await this.teamClusterDaemonClient.command(teamClusterId, TEAM_CLUSTER_DAEMON_COMMAND.object.uploadChunk, {
                transferId,
                index: chunkIndex,
                data: chunk.toString('base64')
            }, {
                timeoutClass: 'long-running-control-plane'
            });
            chunkIndex += 1;
        };

        for await (const streamChunk of objectStream) {
            const bufferChunk = Buffer.isBuffer(streamChunk)
                ? streamChunk
                : Buffer.from(streamChunk);

            pendingBuffer = pendingBuffer.length === 0
                ? bufferChunk
                : Buffer.concat([pendingBuffer, bufferChunk]);

            while (pendingBuffer.length >= PLUGIN_UPLOAD_CHUNK_SIZE) {
                await sendChunk(pendingBuffer.subarray(0, PLUGIN_UPLOAD_CHUNK_SIZE));
                pendingBuffer = pendingBuffer.subarray(PLUGIN_UPLOAD_CHUNK_SIZE);
            }
        }

        if (pendingBuffer.length > 0 || chunkIndex === 0) {
            await sendChunk(pendingBuffer);
        }

        if (chunkIndex !== totalChunks) {
            throw new Error(`Chunked plugin upload chunk count mismatch expected=${totalChunks} actual=${chunkIndex}`);
        }
    }
};
