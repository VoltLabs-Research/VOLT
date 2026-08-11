import analysisExecutionLogService from '@modules/analysis/services/AnalysisExecutionLogService';
import { ProvenanceService } from '@modules/analysis/services/ProvenanceService';
import pluginDebugSessionRegistry from '@modules/plugin/services/PluginDebugSessionRegistryService';
import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import { toTeamClusterLike } from '@modules/cluster/contracts/team-cluster';
import clusterDaemonLifecycleService from '@modules/cluster/services/daemon/ClusterDaemonLifecycleService';
import daemonSceneArtifactIngestService from '@modules/cluster/services/daemon/DaemonSceneArtifactIngestService';
import teamClusterReverseChannelService from '@modules/cluster/services/reverse-channel/TeamClusterReverseChannelService';
import type { TeamClusterDaemonInboundStreamPayload } from '@modules/cluster/services/reverse-channel/reverse-channel-protocol';
import {
    ChannelCommands,
    TEAM_CLUSTER_DAEMON_MESSAGE_EVENT,
    TEAM_CLUSTER_DAEMON_STREAM_ID,
    type ClusterRuntimeLifecycleCommand,
    type TeamClusterDaemonAnalysisLogChunkStream,
    type TeamClusterDaemonCommandMessage,
    type TeamClusterDaemonDebugLogChunkStream,
    type TeamClusterDaemonMessage,
    type TeamClusterDaemonSceneArtifactUpsertBatchStream
} from '@modules/cluster/socket/TeamClusterSocketProtocol';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';

type EmitToSocket = (socketId: string, event: string, payload: unknown) => void;

/**
 * Routes everything a registered daemon sends us: the runtime.* commands it invokes
 * on the control plane, the job/provenance events it reports, and the JSON stream
 * bodies it pushes. Client-facing socket traffic is not handled here.
 */
export default class TeamClusterDaemonFrameRouter {
    readonly #emitToSocket: EmitToSocket;
    readonly #onHeartbeat: (teamClusterId: string) => void;
    readonly #provenanceService = new ProvenanceService();

    constructor(emitToSocket: EmitToSocket, onHeartbeat: (teamClusterId: string) => void) {
        this.#emitToSocket = emitToSocket;
        this.#onHeartbeat = onHeartbeat;
    }

    /** Subscribes to the streams a daemon opens on its own; returns the unsubscribers. */
    registerInboundStreamConsumers(): Array<() => void> {
        return [
            teamClusterReverseChannelService.registerInboundStreamConsumer(
                TEAM_CLUSTER_DAEMON_STREAM_ID.AnalysisLogChunk,
                (message) => {
                    void this.#handleAnalysisLogChunk(message);
                }
            ),
            teamClusterReverseChannelService.registerInboundStreamConsumer(
                TEAM_CLUSTER_DAEMON_STREAM_ID.DebugLogChunk,
                (message) => {
                    void this.#handleDebugLogChunk(message);
                }
            ),
            teamClusterReverseChannelService.registerInboundStreamConsumer(
                TEAM_CLUSTER_DAEMON_STREAM_ID.TrajectorySceneArtifactUpsertBatch,
                (message) => {
                    void this.#handleSceneArtifactUpsertBatch(message);
                }
            )
        ];
    }

    /** A daemon only ever invokes two commands on the control plane: config-get and lifecycle. */
    async handleCommand(socketId: string, payload: TeamClusterDaemonCommandMessage): Promise<void> {
        if (payload.command === ChannelCommands.RuntimeConfigGet) {
            await this.#emitRuntimeConfig(socketId, payload.requestId);
            return;
        }

        if (payload.command !== 'runtime.lifecycle') {
            this.#emitResponse(socketId, {
                type: 'response',
                requestId: payload.requestId,
                ok: false,
                status: 404,
                message: `Unknown daemon server command: ${payload.command}`
            });
            return;
        }

        try {
            this.#emitSuccess(socketId, payload.requestId, await clusterDaemonLifecycleService.updateLifecycle(
                payload.payload as ClusterRuntimeLifecycleCommand
            ));
        } catch (error: unknown) {
            const appError = error as ApplicationError;
            this.#emitResponse(socketId, {
                type: 'response',
                requestId: payload.requestId,
                ok: false,
                status: appError.statusCode,
                message: appError.message
            });
        }
    }

    /** Returns false for frames the reverse channel itself has to handle. */
    async handleEvent(socketId: string, payload: TeamClusterDaemonMessage): Promise<boolean> {
        const registeredTeamClusterId = teamClusterReverseChannelService.getRegisteredTeamClusterId(socketId);

        if ('teamClusterId' in payload && registeredTeamClusterId && payload.teamClusterId !== registeredTeamClusterId) {
            logger.warn(`Ignoring daemon server event with mismatched team cluster id registeredTeamClusterId=${registeredTeamClusterId} payloadTeamClusterId=${payload.teamClusterId} type=${payload.type}`);
            return true;
        }

        switch (payload.type) {
            case 'analysis-job-completion':
            case 'analysis-job-status':
            case 'analysis-stage-status':
            case 'trajectory-raster-job-status':
            case 'trajectory-glb-job-status':
            case 'artifact-upload-job-status':
                try {
                    await clusterDaemonLifecycleService.processDaemonJobCompletion(payload);
                } catch (error: unknown) {
                    const appError = error as ApplicationError;
                    logger.warn(`Failed to process daemon job event type=${payload.type} statusCode=${appError.statusCode} message=${appError.message}`);
                }
                return true;

            case 'runtime-heartbeat':
                this.#onHeartbeat(payload.teamClusterId);
                try {
                    await clusterDaemonLifecycleService.recordHeartbeat(payload);
                } catch (error: unknown) {
                    const appError = error as ApplicationError;
                    logger.warn(`Failed to record daemon heartbeat teamClusterId=${payload.teamClusterId} statusCode=${appError.statusCode} message=${appError.message}`);
                }
                return true;

            case 'analysis-provenance':
                this.#provenanceService.recordAnalysisExecution({
                    ...payload,
                    executedAt: new Date(payload.executedAt)
                }).catch((err: unknown) => {
                    logger.warn({ err }, 'Failed to record analysis provenance from daemon event');
                });
                return true;

            default:
                return false;
        }
    }

    async #emitRuntimeConfig(socketId: string, requestId: string): Promise<void> {
        const teamClusterId = teamClusterReverseChannelService.getRegisteredTeamClusterId(socketId);
        if (!teamClusterId) {
            this.#emitResponse(socketId, {
                type: 'response',
                requestId,
                ok: false,
                status: 401,
                message: 'Daemon socket is not registered'
            });
            return;
        }

        const entity = await TeamClusterEntity.findOneBy({ id: teamClusterId });
        if (!entity) {
            this.#emitResponse(socketId, {
                type: 'response',
                requestId,
                ok: false,
                status: 404,
                message: 'Team cluster not found'
            });
            return;
        }

        const teamCluster = toTeamClusterLike(entity);
        this.#emitSuccess(socketId, requestId, {
            queueConcurrency: teamCluster.props.queueConcurrency,
            queueScopeLimits: teamCluster.props.queueScopeLimits,
            roleConfig: teamCluster.props.roleConfig,
            effectiveCapabilities: teamCluster.effectiveCapabilities
        });
    }

    async #handleAnalysisLogChunk(message: TeamClusterDaemonInboundStreamPayload): Promise<void> {
        const payload = this.#parseStreamPayload<TeamClusterDaemonAnalysisLogChunkStream>(message);
        if (!payload) {
            return;
        }

        /*
         * Log persistence goes through the daemon reverse tunnel, so a dropped tunnel
         * rejects here. This runs detached from any request, so it has to contain its
         * own failures: an unpersisted log line must never take the process down.
         */
        try {
            await analysisExecutionLogService.appendFrameSegments({
                analysisId: payload.analysisId,
                teamId: payload.teamId,
                trajectoryId: payload.trajectoryId,
                jobId: payload.jobId,
                timestep: payload.timestep,
                segments: payload.segments
            });
        } catch (error: unknown) {
            const appError = error as ApplicationError;
            logger.warn(`Failed to append daemon analysis log chunk analysisId=${payload.analysisId} timestep=${payload.timestep} statusCode=${appError.statusCode} message=${appError.message}`);
        }
    }

    async #handleDebugLogChunk(message: TeamClusterDaemonInboundStreamPayload): Promise<void> {
        const payload = this.#parseStreamPayload<TeamClusterDaemonDebugLogChunkStream>(message);
        if (!payload) {
            return;
        }

        pluginDebugSessionRegistry.emitLogChunk(
            payload.sessionId,
            payload.teamClusterId,
            payload.nodeId,
            payload.segments
        );
    }

    async #handleSceneArtifactUpsertBatch(message: TeamClusterDaemonInboundStreamPayload): Promise<void> {
        const payload = this.#parseStreamPayload<TeamClusterDaemonSceneArtifactUpsertBatchStream>(message);
        if (!payload) {
            return;
        }

        try {
            await daemonSceneArtifactIngestService.processBatch(payload.items.map((item) => ({
                ...item,
                teamClusterId: payload.teamClusterId,
                daemonPassword: payload.daemonPassword
            })));
        } catch (error: unknown) {
            const appError = error as ApplicationError;
            logger.warn(`Failed to process daemon scene artifact batch streamId=${message.streamId} batchSize=${payload.items.length} statusCode=${appError.statusCode} message=${appError.message}`);
        }
    }

    /**
     * A stream body arrives as bytes, so it must be parsed; the cluster id is then
     * cross-checked against the socket's registration so one daemon cannot report
     * on behalf of another.
     */
    #parseStreamPayload<TPayload extends { teamClusterId: string }>(
        message: TeamClusterDaemonInboundStreamPayload
    ): TPayload | null {
        let payload: TPayload;
        try {
            payload = JSON.parse(message.chunk.toString('utf8')) as TPayload;
        } catch (error: unknown) {
            logger.warn(
                error,
                `Failed to parse daemon stream chunk JSON streamId=${message.streamId} requestId=${message.requestId}`
            );
            return null;
        }

        if (payload.teamClusterId !== message.teamClusterId) {
            logger.warn(
                `Ignoring daemon stream payload with mismatched cluster streamId=${message.streamId} socketClusterId=${message.teamClusterId} payloadClusterId=${payload.teamClusterId}`
            );
            return null;
        }

        return payload;
    }

    #emitSuccess<T>(socketId: string, requestId: string, data: T): void {
        this.#emitResponse(socketId, {
            type: 'response',
            requestId,
            ok: true,
            status: 200,
            data: {
                status: 'success',
                data
            }
        });
    }

    #emitResponse(socketId: string, payload: TeamClusterDaemonMessage): void {
        this.#emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, payload);
    }
}
