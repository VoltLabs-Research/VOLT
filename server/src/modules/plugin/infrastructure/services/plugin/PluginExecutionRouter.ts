import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import type Analysis from '@modules/analysis/domain/entities/Analysis';
import type Plugin from '@modules/plugin/domain/entities/plugin/Plugin';
import type {
    IPluginExecutionRouter,
    PluginReferenceExecutionRequest,
    RoutePluginExecutionInput
} from '@modules/plugin/domain/port/plugin/IPluginExecutionRouter';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import StoragePlacementService from '@modules/cluster/application/services/StoragePlacementService';
import DaemonAnalysisCompletionService from '@modules/cluster/infrastructure/services/DaemonAnalysisCompletionService';
import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type IORedis from 'ioredis';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import { inject } from 'tsyringe';

const gzipAsync = promisify(zlib.gzip);

const DISPATCH_SECTION_CACHE_TTL_SECONDS = 600;
// Plugin binaries are immutable per hash, so the daemon's local cache only
// needs to be re-validated occasionally. 10 minutes is short enough to recover
// from the daemon evicting the binary, long enough to skip the round-trip on
// the realistic case of the same user repeatedly running the same plugin.
const PLUGIN_SYNC_CACHE_TTL_SECONDS = 600;
const PLUGIN_SYNC_CACHE_PREFIX = 'plugin-sync:';

interface DaemonPluginSyncResponse {
    synced: boolean;
    objectKey: string;
}

interface DaemonAnalysisStartResponse {
    queued: boolean;
    totalJobs: number;
    jobs: DaemonAnalysisJob[];
}

interface DaemonAnalysisJob {
    jobId: string;
    name: string;
    teamId: string;
    timestep: number;
    trajectoryId: string;
    analysisId: string;
    queueType: string;
}

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
}

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
}

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
}

interface TrajectoryFramePayload {
    timestep: number;
    natoms: number;
    simulationCell: string;
}

interface PluginDispatchPayload extends Record<string, unknown> {
    analysis: DaemonAnalysisPayload;
    analysisId: string;
    pluginId: string;
    pluginDisplayName: string;
    teamId: string;
    teamClusterId: string;
    trajectoryId: string;
    trajectoryFramesCompressed: string;
    workflowCompressed: string;
    nestedPluginsCompressed: string;
    pluginReferenceExecutionsCompressed: string;
    config: Record<string, unknown>;
    selectedFrameOnly?: boolean;
    selectedTimesteps?: number[];
    timestep?: number;
}

interface DispatchCleanupSummary {
    duplicateDependencyCount: number;
    duplicateNestedPluginCount: number;
    duplicatePluginReferenceExecutionCount: number;
    uniquePluginSyncCount: number;
    payloadBytes: number;
}

interface EncodedDispatchSection {
    rawBytes: number;
    storedBytes: number;
    compressedValue: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const injectOwnerClusterIdIntoWorkflow = (
    workflow: WorkflowSerializable,
    ownerClusterId: string
): WorkflowSerializable => {
    if (!ownerClusterId) {
        return workflow;
    }

    return {
        ...workflow,
        nodes: workflow.nodes.map((node) => {
            if (node.type !== 'entrypoint' || !isRecord(node.data.entrypoint)) {
                return node;
            }

            return {
                ...node,
                data: {
                    ...node.data,
                    entrypoint: {
                        ...node.data.entrypoint,
                        ownerClusterId
                    }
                }
            };
        })
    };
};

const buildNestedPluginDefinitionWithOwner = (
    plugin: Plugin,
    ownerClusterId: string
): NestedPluginDefinition => {
    return {
        pluginId: plugin.id,
        workflow: injectOwnerClusterIdIntoWorkflow(
            plugin.props.workflow.props as unknown as WorkflowSerializable,
            ownerClusterId
        )
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

const encodeDispatchSection = async <T>(value: T): Promise<EncodedDispatchSection> => {
    // Why: single serialization pass — the Buffer carries both the byte count
    // and the raw bytes fed to gzip, eliminating `JSON.stringify(value)` +
    // `Buffer.byteLength(stringified)` as distinct passes over the same data.
    const serializedBuffer = Buffer.from(JSON.stringify(value), 'utf8');
    const rawBytes = serializedBuffer.byteLength;

    const compressed = await gzipAsync(serializedBuffer);
    const compressedValue = compressed.toString('base64');
    return {
        rawBytes,
        storedBytes: compressedValue.length,
        compressedValue
    };
};

@Singleton(PLUGIN_TOKENS.PluginExecutionRouter)
export default class PluginExecutionRouter implements IPluginExecutionRouter {
    constructor(
        private readonly storagePlacementService: StoragePlacementService,
        private readonly teamClusterRepository: TeamClusterRepository,
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient,
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,
        private readonly daemonAnalysisCompletionService: DaemonAnalysisCompletionService,
        @inject(SHARED_TOKENS.RedisClient)
        private readonly redis: IORedis
    ) {}

    private readonly inflightEncodes = new Map<string, Promise<EncodedDispatchSection>>();
    private readonly inflightPluginSyncs = new Map<string, Promise<void>>();

    private async cachedEncode<T>(cacheKey: string, value: T): Promise<EncodedDispatchSection> {
        try {
            const cached = await this.redis.get(cacheKey);
            if (cached) {
                return JSON.parse(cached) as EncodedDispatchSection;
            }
        } catch (error: unknown) {
            logger.warn({ err: error, cacheKey }, '@plugin-execution-router: dispatch section cache read failed');
        }

        const existing = this.inflightEncodes.get(cacheKey);
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

        this.inflightEncodes.set(cacheKey, pending);
        return pending;
    }

    private encodeWorkflowSection(plugin: Plugin, ownerClusterId: string): Promise<EncodedDispatchSection> {
        const revision = plugin.props.updatedAt.getTime();
        const cacheKey = `plugin-dispatch:workflow:${plugin.id}:${revision}:${ownerClusterId || 'unknown-owner'}`;
        return this.cachedEncode(
            cacheKey,
            injectOwnerClusterIdIntoWorkflow(
                plugin.props.workflow.props as unknown as WorkflowSerializable,
                ownerClusterId
            )
        );
    }

    private encodeNestedPluginsSection(
        rootPluginId: string,
        deps: Plugin[],
        nestedPlugins: NestedPluginDefinition[],
        ownerClusterIds: Map<string, string>
    ): Promise<EncodedDispatchSection> {
        const revisionToken = deps
            .map((d) => `${d.id}@${d.props.updatedAt.getTime()}@${ownerClusterIds.get(d.id) || 'unknown-owner'}`)
            .sort()
            .join('|');
        const cacheKey = `plugin-dispatch:nested:${rootPluginId}:${revisionToken || 'empty'}`;
        return this.cachedEncode(cacheKey, nestedPlugins);
    }

    private async resolvePluginBinaryOwnerClusterId(plugin: Plugin): Promise<string> {
        const placement = await this.storagePlacementService.ensurePlacement('plugin-binary', plugin.id);
        const currentOwnerClusterId = placement.props.primaryClusterId;
        const entrypointNode = plugin.props.workflow.props.nodes.find((node) => node.type === 'entrypoint');
        const objectKey = entrypointNode?.data.entrypoint?.binaryObjectPath;

        if (!objectKey) {
            return currentOwnerClusterId;
        }

        if (await this.pluginBinaryExists(currentOwnerClusterId, objectKey)) {
            return currentOwnerClusterId;
        }

        const teamClusters = await this.teamClusterRepository.export({
            filter: {
                team: plugin.props.team
            }
        });

        for (const candidateCluster of teamClusters) {
            if (candidateCluster.id === currentOwnerClusterId) {
                continue;
            }

            if (!(await this.pluginBinaryExists(candidateCluster.id, objectKey))) {
                continue;
            }

            await this.storagePlacementService.switchPrimaryCluster(
                'plugin-binary',
                plugin.id,
                candidateCluster.id,
                {
                    replicaClusterIds: placement.props.replicaClusterIds,
                    state: placement.props.state,
                    lastVerifiedAt: new Date()
                }
            );

            logger.warn(
                {
                    pluginId: plugin.id,
                    objectKey,
                    previousOwnerClusterId: currentOwnerClusterId,
                    repairedOwnerClusterId: candidateCluster.id
                },
                '@plugin-execution-router: repaired plugin binary storage placement owner'
            );

            return candidateCluster.id;
        }

        return currentOwnerClusterId;
    }

    private async pluginBinaryExists(ownerClusterId: string, objectKey: string): Promise<boolean> {
        try {
            await this.objectGatewayClient.head(ownerClusterId, TEAM_CLUSTER_BUCKETS.PLUGINS, objectKey);
            return true;
        } catch (error: unknown) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
                return false;
            }

            logger.warn(
                { err: error, ownerClusterId, objectKey },
                '@plugin-execution-router: failed to inspect plugin binary while resolving owner'
            );
            return false;
        }
    }

    async route(input: RoutePluginExecutionInput): Promise<void> {
        const uniqueDependencyPlugins = dedupePluginsById(input.pluginDependencies);
        const uniquePluginsToSync = dedupePluginsById([
            input.plugin,
            ...uniqueDependencyPlugins
        ]);

        const pluginOwnerClusterIds = new Map(await Promise.all(
            uniquePluginsToSync.map(async (plugin) => {
                const ownerClusterId = await this.resolvePluginBinaryOwnerClusterId(plugin);
                return [plugin.id, ownerClusterId] as const;
            })
        ));
        const rootPluginOwnerClusterId = pluginOwnerClusterIds.get(input.plugin.id) ?? '';
        const nestedPlugins = uniqueDependencyPlugins.map((plugin) => buildNestedPluginDefinitionWithOwner(
            plugin,
            pluginOwnerClusterIds.get(plugin.id) ?? ''
        ));
        const pluginReferenceExecutions = dedupePluginReferenceExecutions(input.pluginReferenceExecutions);

        const [, encodedTrajectoryFrames, encodedWorkflow, encodedNestedPlugins, encodedPluginReferenceExecutions] = await Promise.all([
            Promise.all(uniquePluginsToSync.map((dependency) => this.syncPluginBinaryIfNeeded(
                input.teamClusterId,
                dependency,
                pluginOwnerClusterIds.get(dependency.id)
            ))),
            encodeDispatchSection(input.trajectoryFrames),
            this.encodeWorkflowSection(input.plugin, rootPluginOwnerClusterId),
            this.encodeNestedPluginsSection(input.plugin.id, uniqueDependencyPlugins, nestedPlugins, pluginOwnerClusterIds),
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
            trajectoryFramesCompressed: encodedTrajectoryFrames.compressedValue,
            workflowCompressed: encodedWorkflow.compressedValue,
            nestedPluginsCompressed: encodedNestedPlugins.compressedValue,
            pluginReferenceExecutionsCompressed: encodedPluginReferenceExecutions.compressedValue,
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

    private async syncPluginBinaryIfNeeded(
        teamClusterId: string,
        plugin: Plugin,
        ownerClusterIdOverride?: string
    ): Promise<void> {
        const entrypointNode = plugin.props.workflow.props.nodes.find((node) => node.type === 'entrypoint');
        const entrypoint = entrypointNode?.data.entrypoint;
        const objectKey = entrypoint?.binaryObjectPath;
        if (!objectKey) {
            throw ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_EXECUTE,
                `Plugin ${plugin.id} is missing an uploaded entrypoint binary`
            );
        }

        const ownerClusterId = ownerClusterIdOverride
            ?? (await this.storagePlacementService.ensurePlacement('plugin-binary', plugin.id)).props.primaryClusterId;
        const expectedHash = entrypoint?.binaryHash ?? await this.readObjectSha256(ownerClusterId, objectKey);

        const syncKey = `${teamClusterId}:${ownerClusterId}:${plugin.id}:${objectKey}:${expectedHash ?? 'unknown-hash'}`;
        const redisKey = `${PLUGIN_SYNC_CACHE_PREFIX}${syncKey}`;

        try {
            const cached = await this.redis.get(redisKey);
            if (cached === '1') {
                return;
            }
        } catch (error: unknown) {
            logger.warn({ err: error, syncKey }, '@plugin-execution-router: plugin sync cache read failed');
        }

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
                    ownerClusterId,
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

            try {
                await this.redis.setex(redisKey, PLUGIN_SYNC_CACHE_TTL_SECONDS, '1');
            } catch (error: unknown) {
                logger.warn({ err: error, syncKey }, '@plugin-execution-router: plugin sync cache write failed');
            }
        })().finally(() => {
            this.inflightPluginSyncs.delete(syncKey);
        });

        this.inflightPluginSyncs.set(syncKey, pendingSync);
        return pendingSync;
    }

    private async readObjectSha256(ownerClusterId: string, objectKey: string): Promise<string | undefined> {
        let objectHead;
        try {
            objectHead = await this.objectGatewayClient.head(ownerClusterId, TEAM_CLUSTER_BUCKETS.PLUGINS, objectKey);
        } catch (error: unknown) {
            if (error instanceof ApplicationError && error.statusCode === 404) {
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

        const directHash = objectHead.metadata.sha256;
        return typeof directHash === 'string' && directHash.length > 0
            ? directHash
            : undefined;
    }
}
