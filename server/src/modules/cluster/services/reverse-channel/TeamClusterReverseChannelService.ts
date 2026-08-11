import { ErrorCodes } from '@core/constants/error-codes';
import bytePlaneResolver from '@modules/cluster/services/object-gateway/BytePlaneResolver';
import type { ContainerTerminalAttachment } from '@shared/contracts/ports';
import containerDeploymentProgressService from '@modules/container/services/ContainerDeploymentProgressService';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import type { TeamClusterReverseTunnelStream } from '@modules/cluster/services/reverse-channel/TeamClusterReverseTunnelStream';
import type { TeamClusterReverseWebSocketStream } from '@modules/cluster/services/reverse-channel/TeamClusterReverseWebSocket';
import {
    TEAM_CLUSTER_DAEMON_MESSAGE_EVENT,
    TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL,
    TeamClusterDaemonResponseType,
    type TeamClusterDaemonMessage,
    type TeamClusterDaemonRuntimeProgressPayload,
    type TeamClusterDaemonSocketChannel,
    type TeamClusterDaemonSocketResponsePayload,
    type TeamClusterDaemonSocketStreamPayload,
    type TeamClusterDaemonSocketStreamStatePayload
} from '@modules/cluster/socket/TeamClusterSocketProtocol';
import ApplicationError from '@shared/application/errors/ApplicationError';
import TeamClusterDaemonConnectionRegistry, {
    type ReleasedDaemonConnection
} from '@modules/cluster/services/team-cluster/TeamClusterDaemonConnectionRegistry';
import TeamClusterReverseAttachedSessions from '@modules/cluster/services/reverse-channel/TeamClusterReverseAttachedSessions';
import TeamClusterReverseInboundStreams from '@modules/cluster/services/reverse-channel/TeamClusterReverseInboundStreams';
import TeamClusterReverseTunnelSessions from '@modules/cluster/services/reverse-channel/TeamClusterReverseTunnelSessions';
import ReverseChannelPendingEntries, {
    createBufferedStream,
    type PendingStreamEntry
} from '@modules/cluster/services/reverse-channel/reverse-channel-pending';
import {
    clearPendingTimeout,
    createCommandMessage,
    unwrapEnvelopeBuffer,
    type TeamClusterCommandOptions,
    type TeamClusterDaemonCommandPayload,
    type TeamClusterDaemonInboundStreamConsumer,
    type TeamClusterReverseChannelStreamAttachment,
    type TeamClusterTunnelOpenOptions,
    type TeamClusterTunnelOpenRequest
} from '@modules/cluster/services/reverse-channel/reverse-channel-protocol';
import logger from '@shared/infrastructure/logger';
import { randomUUID } from 'node:crypto';
import teamClusterExposureRegistryService from '@modules/cluster/services/team-cluster/TeamClusterExposureRegistryService';

const REQUEST_TIMEOUT_MS = 30_000;
const DAEMON_CONNECTION_WAIT_TIMEOUT_MS = 30_000;

/**
 * The daemon reverse channel: a cluster daemon dials us, and every subsequent
 * control-plane request rides back out over that socket. This service owns the
 * socket bookkeeping and the frame router, and delegates each frame family to the
 * collaborator that owns its state.
 */
class TeamClusterReverseChannelService {
    readonly #connections = new TeamClusterDaemonConnectionRegistry();
    readonly #pending = new ReverseChannelPendingEntries();
    readonly #inboundStreams = new TeamClusterReverseInboundStreams();

    readonly #sessions = new TeamClusterReverseAttachedSessions({
        pending: this.#pending,
        requireSocketId: (teamClusterId) => this.#requireDaemonSocketId(teamClusterId),
        emitToDaemon: (socketId, payload) => {
            this.#emitToDaemon(socketId, payload);
        },
        emitCommand: (socketId, requestId, command, payload) => {
            this.#emitCommand(socketId, requestId, {
                command,
                payload,
                responseType: TeamClusterDaemonResponseType.Json
            });
        }
    });

    readonly #tunnels = new TeamClusterReverseTunnelSessions({
        pending: this.#pending,
        requireSocketId: (teamClusterId, channel) => this.#requireDaemonSocketId(teamClusterId, channel),
        emitToDaemon: (socketId, payload) => {
            this.#emitToDaemon(socketId, payload);
        }
    });

    registerDaemonConnection(
        socketId: string,
        teamClusterId: string,
        channel: TeamClusterDaemonSocketChannel = TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.Control
    ): void {
        const previousSocketId = this.#connections.socketIdFor(teamClusterId, channel);
        if (previousSocketId && previousSocketId !== socketId) {
            this.unregisterDaemonConnection(previousSocketId);
        }

        this.#connections.bind(socketId, teamClusterId, channel);
    }

    unregisterDaemonConnection(socketId: string): ReleasedDaemonConnection | null {
        const released = this.#connections.release(socketId);

        if (released?.wasBound) {
            if (released.channel === TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.Control) {
                teamClusterExposureRegistryService.clearTeamCluster(released.teamClusterId);
            }
            logger.warn(`[ReverseChannel] Daemon ${released.channel} connection unregistered socketId=${socketId} teamClusterId=${released.teamClusterId}`);
        }

        this.#pending.rejectSocket(socketId, new Error('Team cluster daemon connection was lost'));

        return released;
    }

    isRegisteredDaemonSocket(socketId: string): boolean {
        return this.#connections.isRegistered(socketId);
    }

    getRegisteredTeamClusterId(socketId: string): string | null {
        return this.#connections.teamClusterIdFor(socketId) ?? null;
    }

    hasDaemonConnection(teamClusterId: string, channel: TeamClusterDaemonSocketChannel): boolean {
        return this.#connections.hasConnection(teamClusterId, channel);
    }

    registerInboundStreamConsumer(
        streamId: string,
        consumer: TeamClusterDaemonInboundStreamConsumer
    ): () => void {
        return this.#inboundStreams.register(streamId, consumer);
    }

    async command(
        teamClusterId: string,
        payload: TeamClusterDaemonCommandPayload,
        options?: TeamClusterCommandOptions
    ): Promise<TeamClusterDaemonSocketResponsePayload> {
        const socketId = await this.#requireDaemonSocketId(teamClusterId);
        const requestId = randomUUID();

        return this.#pending.create({
            correlationId: requestId,
            entryType: 'response',
            timeoutMs: options?.timeoutMs ?? REQUEST_TIMEOUT_MS,
            timeoutMessage: 'Timed out waiting for daemon response',
            createEntry: (resolve, reject, timeout) => ({
                type: 'response',
                socketId,
                timeout,
                resolve,
                reject
            }),
            emitMessage: () => {
                this.#emitCommand(socketId, requestId, payload);
            }
        });
    }

    async openCommandStream(
        teamClusterId: string,
        payload: TeamClusterDaemonCommandPayload
    ): Promise<TeamClusterReverseChannelStreamAttachment> {
        const socketId = await this.#requireDaemonSocketId(teamClusterId);
        const requestId = randomUUID();
        const stream = createBufferedStream();

        return this.#pending.create({
            correlationId: requestId,
            entryType: 'stream',
            timeoutMs: REQUEST_TIMEOUT_MS,
            timeoutMessage: 'Timed out waiting for daemon stream response',
            createEntry: (resolve, reject, timeout) => ({
                type: 'stream',
                socketId,
                timeout,
                stream,
                resolve,
                reject
            }),
            emitMessage: () => {
                this.#emitCommand(socketId, requestId, {
                    command: payload.command,
                    payload: payload.payload,
                    responseType: TeamClusterDaemonResponseType.Stream
                });
            }
        });
    }

    async attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment> {
        return this.#sessions.attachTerminal(teamClusterId, containerId);
    }

    async attachWebSocket(
        teamClusterId: string,
        targetUrl: string,
        protocols?: string[]
    ): Promise<TeamClusterReverseWebSocketStream> {
        return this.#sessions.attachWebSocket(teamClusterId, targetUrl, protocols);
    }

    async openTunnel(
        teamClusterId: string,
        request: TeamClusterTunnelOpenRequest,
        options?: TeamClusterTunnelOpenOptions
    ): Promise<TeamClusterReverseTunnelStream> {
        return this.#tunnels.open(teamClusterId, request, options);
    }

    handleMessage(socketId: string, payload: TeamClusterDaemonMessage): void {
        const teamClusterId = this.#connections.teamClusterIdFor(socketId);
        if (!teamClusterId) {
            return;
        }

        switch (payload.type) {
            case 'exposure-snapshot':
                teamClusterExposureRegistryService.replaceTeamClusterExposures(teamClusterId, payload.exposures);
                /* A daemon that just republished is worth dialling directly again. */
                bytePlaneResolver.clearTeamCluster(teamClusterId);
                return;

            case 'response':
                this.#handleResponse(payload);
                return;

            case 'stream':
                this.#handleStreamChunk(socketId, teamClusterId, payload);
                return;

            case 'stream-end':
                this.#handleStreamEnd(payload);
                return;

            case 'session-data':
                this.#sessions.handleData(payload);
                return;

            case 'session-end':
                this.#sessions.handleEnd(payload);
                return;

            case 'tunnel-state':
                this.#tunnels.handleState(payload);
                return;

            case 'tunnel-data':
                this.#tunnels.handleData(payload);
                return;

            case 'tunnel-drain':
                this.#tunnels.handleDrain(payload);
                return;

            case 'tunnel-close':
                this.#tunnels.handleClose(payload);
                return;

            case 'runtime-progress':
                this.#handleRuntimeProgress(teamClusterId, payload).catch(() => {
                    logger.error(`[ReverseChannel] Runtime progress handling failed socketId=${socketId}`);
                });
                return;

            default:
                return;
        }
    }

    async #handleRuntimeProgress(
        teamClusterId: string,
        payload: TeamClusterDaemonRuntimeProgressPayload
    ): Promise<void> {
        const progress = payload.payload;
        if (payload.action !== 'container-create' || !progress) {
            return;
        }

        await containerDeploymentProgressService.emitToTeam({
            operationId: progress.operationId,
            teamClusterId,
            stage: payload.stage,
            step: progress.step,
            image: progress.image,
            containerName: progress.containerName,
            containerId: progress.containerId,
            timestamp: payload.timestamp
        });
    }

    #handleResponse(payload: TeamClusterDaemonSocketResponsePayload): void {
        const entry = this.#pending.get(payload.requestId);

        switch (entry?.type) {
            case 'response':
                this.#pending.delete(payload.requestId);
                clearPendingTimeout(entry.timeout);
                entry.resolve(payload);
                return;

            case 'stream':
                this.#handleStreamOpenResponse(payload, entry);
                return;

            case 'terminal':
            case 'websocket':
                this.#sessions.handleAttachResponse(payload, entry);
                return;

            default:
                return;
        }
    }

    #handleStreamOpenResponse(
        payload: TeamClusterDaemonSocketResponsePayload,
        entry: PendingStreamEntry
    ): void {
        clearPendingTimeout(entry.timeout);
        entry.timeout = null;

        if (!payload.ok) {
            this.#pending.delete(payload.requestId);
            entry.reject(new ApplicationError(
                ErrorCodes.TEAM_CLUSTER_DAEMON_STREAM_REQUEST_FAILED,
                payload.message || 'Daemon stream request failed',
                {
                    statusCode: payload.status,
                    headers: payload.headers || {}
                }
            ));
            return;
        }

        entry.streamId = payload.streamId || payload.requestId;
        this.#pending.touch(payload.requestId);
        entry.resolve({
            status: payload.status,
            headers: payload.headers || {},
            stream: entry.stream
        });
    }

    /** A chunk nobody is awaiting belongs to a stream the daemon opened on its own. */
    #handleStreamChunk(
        socketId: string,
        teamClusterId: string,
        payload: TeamClusterDaemonSocketStreamPayload
    ): void {
        const entry = this.#pending.get(payload.requestId);
        if (entry?.type !== 'stream') {
            this.#inboundStreams.dispatchChunk(socketId, teamClusterId, payload);
            return;
        }

        if (entry.streamId && entry.streamId !== payload.streamId) {
            return;
        }

        this.#pending.touch(payload.requestId);
        if (!entry.stream.write(unwrapEnvelopeBuffer(payload.chunk))) {
            logger.debug(`[ReverseChannel] Stream backpressure hit requestId=${payload.requestId}`);
        }
    }

    #handleStreamEnd(payload: TeamClusterDaemonSocketStreamStatePayload): void {
        const entry = this.#pending.get(payload.requestId);
        if (entry?.type !== 'stream') {
            this.#inboundStreams.dispatchEnd(payload);
            return;
        }

        if (entry.streamId && entry.streamId !== payload.streamId) {
            return;
        }

        entry.stream.end();
        this.#pending.delete(payload.requestId);
    }

    #emitToDaemon(socketId: string, payload: TeamClusterDaemonMessage): void {
        socketIOEmitter.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, payload);
    }

    #emitCommand(socketId: string, requestId: string, payload: TeamClusterDaemonCommandPayload): void {
        this.#emitToDaemon(socketId, createCommandMessage(requestId, payload));
    }

    #requireDaemonSocketId(
        teamClusterId: string,
        channel: TeamClusterDaemonSocketChannel = TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.Control
    ): Promise<string> {
        return this.#connections.requireSocketId(teamClusterId, channel, DAEMON_CONNECTION_WAIT_TIMEOUT_MS);
    }
}

export default new TeamClusterReverseChannelService();
