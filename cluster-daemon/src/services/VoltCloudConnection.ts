import { ProcessTeamClusterHealthcheckOutputDTO } from './voltCloudTypes';
import { TeamClusterStatus } from './voltCloudTypes';
import {
    TEAM_CLUSTER_DAEMON_REGISTERED_EVENT,
    TEAM_CLUSTER_DAEMON_REGISTER_EVENT,
    TEAM_CLUSTER_DAEMON_REQUEST_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_ATTACH_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_DETACH_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_INPUT_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_RESIZE_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_ATTACH_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_DETACH_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_INPUT_EVENT,
    type TeamClusterDaemonRegisterPayload,
    type TeamClusterDaemonSocketRequestPayload,
    type TeamClusterDaemonTerminalAttachPayload,
    type TeamClusterDaemonTerminalDetachPayload,
    type TeamClusterDaemonTerminalInputPayload,
    type TeamClusterDaemonTerminalResizePayload,
    type TeamClusterDaemonWebSocketAttachPayload,
    type TeamClusterDaemonWebSocketDataPayload,
    type TeamClusterDaemonWebSocketDetachPayload
} from '../contracts/reverseChannel';
import { RuntimeLifecycleEventType } from '../contracts/events';
import { DaemonConfig } from '../config/env';
import { MetricsSnapshot } from '../contracts/metrics';
import { DockerRuntimeService } from './DockerRuntimeService';
import { MetricsService } from './MetricsService';
import { RuntimeEventBroker } from './RuntimeEventBroker';
import { logger } from './logger';
import { ReverseChannelSocketBridge } from '../websocket/ReverseChannelSocketBridge';
import { postJson } from '../utilities/http';
import { io, Socket } from 'socket.io-client';

interface RuntimeLifecycleUpdateRequest {
    daemonPassword: string;
    status: TeamClusterStatus;
    installedVersion?: string;
};

interface HeartbeatRequest {
    daemonPassword: string;
    installedVersion?: string;
    metrics?: MetricsSnapshot;
};

interface DeleteCompletionRequest {
    daemonPassword: string;
};

export class VoltCloudConnection {
    private daemonPassword: string;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private controlSocket: Socket | null = null;
    private connectedToCloud = false;
    private latestLatencyMs: number | null = null;
    private stopped = false;
    private reconnectAttempt = 0;
    private readonly MAX_RECONNECT_DELAY_MS = 30000;
    private readonly BASE_RECONNECT_DELAY_MS = 1000;
    private readonly reverseChannelSocketBridge: ReverseChannelSocketBridge;

    constructor(
        private readonly config: DaemonConfig,
        private readonly metricsService: MetricsService,
        private readonly eventBroker: RuntimeEventBroker,
        private readonly onRemoteUninstall: () => Promise<void>,
        private readonly dockerRuntimeService?: DockerRuntimeService
    ) {
        this.daemonPassword = config.daemonPassword;
        this.reverseChannelSocketBridge = new ReverseChannelSocketBridge(config, dockerRuntimeService);
    }

    async start(): Promise<void> {
        await this.authenticate();
        this.emitLifecycle(RuntimeLifecycleEventType.Starting, 'Cluster daemon starting');
        this.startHeartbeatLoop();
        this.connectControlSocket();
    }

    async stop(): Promise<void> {
        this.stopped = true;
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }

        if (this.controlSocket) {
            this.controlSocket.close();
            this.controlSocket = null;
        }
    }

    getLatestLatencyMs(): number | null {
        return this.latestLatencyMs;
    }

    isConnectedToCloud(): boolean {
        return this.connectedToCloud;
    }

    getControlSocket(): Socket | null {
        return this.controlSocket;
    }

    async reportDeleteFailed(details: string): Promise<void> {
        await this.sendLifecycleStatus(TeamClusterStatus.DeleteFailed, details);
    }

    async reportDeleting(details: string): Promise<void> {
        await this.sendLifecycleStatus(TeamClusterStatus.Deleting, details);
    }

    async reportDisconnected(details: string): Promise<void> {
        await this.sendLifecycleStatus(TeamClusterStatus.Disconnected, details);
    }

    async reportDeleteCompleted(details: string): Promise<void> {
        if (!this.config.deleteCompletionPath) {
            return;
        }

        try {
            const url = `${this.config.voltCloudUrl}${this.config.deleteCompletionPath}`;
            const requestBody: DeleteCompletionRequest = {
                daemonPassword: this.daemonPassword
            };

            await postJson(url, {
                method: 'POST',
                body: requestBody
            });
        } catch (error: unknown) {
            logger.warn({ err: error, details }, 'Failed to report completed team cluster deletion to VoltCloud');
        }
    }

    private async authenticate(): Promise<void> {
        if (!this.config.enrollmentToken || !this.config.healthcheckPath) {
            return;
        }

        const url = `${this.config.voltCloudUrl}${this.config.healthcheckPath}`;
        const response = await postJson(url, {
            method: 'POST',
            body: {
                enrollmentToken: this.config.enrollmentToken,
                installedVersion: this.config.installedVersion
            }
        });

        const payload = this.readHealthcheckResponse(response.data);

        this.daemonPassword = payload.daemonPassword;
    }

    private startHeartbeatLoop(): void {
        const sendHeartbeat = async () => {
            const startTime = Date.now();
            try {
                const url = `${this.config.voltCloudUrl}${this.config.heartbeatPath}`;
                const requestBody: HeartbeatRequest = {
                    daemonPassword: this.daemonPassword,
                    installedVersion: this.config.installedVersion,
                    metrics: await this.metricsService.collectSnapshot()
                };

                await postJson(url, {
                    method: 'POST',
                    body: requestBody
                });
                this.latestLatencyMs = Date.now() - startTime;
                this.connectedToCloud = true;
                this.metricsService.updateCloudLatency(this.latestLatencyMs);
                this.metricsService.updateCloudConnectionState(true);
                this.emitLifecycle(RuntimeLifecycleEventType.HeartbeatSucceeded, `Heartbeat latency ${this.latestLatencyMs}ms`);
            } catch (error: unknown) {
                const details = error instanceof Error ? error.message : String(error);
                this.connectedToCloud = false;
                this.latestLatencyMs = null;
                this.metricsService.updateCloudLatency(null);
                this.metricsService.updateCloudConnectionState(false);
                this.emitLifecycle(RuntimeLifecycleEventType.HeartbeatFailed, details);
                logger.warn({ err: error }, 'Failed to send team cluster heartbeat');
            }
        };

        sendHeartbeat().catch((error: unknown) => {
            logger.warn({ err: error }, 'Initial heartbeat failed');
        });

        this.heartbeatTimer = setInterval(() => {
            sendHeartbeat().catch((error: unknown) => {
                logger.warn({ err: error }, 'Scheduled heartbeat failed');
            });
        }, this.config.heartbeatIntervalMs);
    }

    private connectControlSocket(): void {
        if (!this.config.controlSocketUrl) {
            return;
        }

        const socket = io(this.config.controlSocketUrl, {
            autoConnect: true,
            forceNew: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: this.BASE_RECONNECT_DELAY_MS,
            reconnectionDelayMax: this.MAX_RECONNECT_DELAY_MS,
            randomizationFactor: 0.3
        });

        socket.on('connect', () => {
            const payload: TeamClusterDaemonRegisterPayload = {
                teamClusterId: this.config.teamClusterId,
                daemonPassword: this.daemonPassword
            };
            socket.emit(TEAM_CLUSTER_DAEMON_REGISTER_EVENT, payload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_REGISTERED_EVENT, () => {
            this.controlSocket = socket;
            this.emitLifecycle(RuntimeLifecycleEventType.CloudSocketConnected, 'Outbound cloud socket connected');
        });

        socket.on(TEAM_CLUSTER_DAEMON_REQUEST_EVENT, async (payload: TeamClusterDaemonSocketRequestPayload) => {
            await this.reverseChannelSocketBridge.handleRequest(socket, payload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_TERMINAL_ATTACH_EVENT, async (payload: TeamClusterDaemonTerminalAttachPayload) => {
            await this.reverseChannelSocketBridge.handleTerminalAttach(socket, payload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_TERMINAL_INPUT_EVENT, (payload: TeamClusterDaemonTerminalInputPayload) => {
            this.reverseChannelSocketBridge.handleTerminalInput(payload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_TERMINAL_RESIZE_EVENT, (payload: TeamClusterDaemonTerminalResizePayload) => {
            this.reverseChannelSocketBridge.handleTerminalResize(payload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_TERMINAL_DETACH_EVENT, (payload: TeamClusterDaemonTerminalDetachPayload) => {
            this.reverseChannelSocketBridge.handleTerminalDetach(payload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_WEBSOCKET_ATTACH_EVENT, (payload: TeamClusterDaemonWebSocketAttachPayload) => {
            this.reverseChannelSocketBridge.handleWebSocketAttach(socket, payload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_WEBSOCKET_INPUT_EVENT, (payload: TeamClusterDaemonWebSocketDataPayload) => {
            this.reverseChannelSocketBridge.handleWebSocketInput(payload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_WEBSOCKET_DETACH_EVENT, (payload: TeamClusterDaemonWebSocketDetachPayload) => {
            this.reverseChannelSocketBridge.handleWebSocketDetach(payload);
        });

        socket.on('disconnect', (reason) => {
            if (this.controlSocket === socket) {
                this.controlSocket = null;
            }

            this.reverseChannelSocketBridge.cleanup();

            this.reconnectAttempt = 0;
            this.emitLifecycle(RuntimeLifecycleEventType.CloudSocketDisconnected, `Outbound cloud socket disconnected (${reason})`);
            // Socket.IO built-in reconnection handles retry automatically
        });

        socket.on('connect_error', (error: Error) => {
            this.reconnectAttempt++;
            const delay = Math.min(
                this.BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempt - 1),
                this.MAX_RECONNECT_DELAY_MS
            );
            logger.warn({ err: error, attempt: this.reconnectAttempt, nextRetryMs: delay }, 'Outbound cloud socket connection error, will retry');
        });

        socket.on('reconnect', (attemptNumber: number) => {
            this.reconnectAttempt = 0;
            logger.info({ attempt: attemptNumber }, 'Outbound cloud socket reconnected');
        });
    }

    private async sendLifecycleStatus(status: TeamClusterStatus, details: string): Promise<void> {
        try {
            const url = `${this.config.voltCloudUrl}${this.config.lifecyclePath}`;
            const requestBody: RuntimeLifecycleUpdateRequest = {
                daemonPassword: this.daemonPassword,
                status,
                installedVersion: this.config.installedVersion
            };

            await postJson(url, {
                method: 'POST',
                body: requestBody
            });
            this.emitLifecycle(RuntimeLifecycleEventType.ServicesReady, details);
        } catch (error: unknown) {
            logger.warn({ err: error, status }, 'Failed to send lifecycle status to VoltCloud');
        }
    }

    private emitLifecycle(type: RuntimeLifecycleEventType, details?: string): void {
        this.eventBroker.emitLifecycle({
            type,
            teamClusterId: this.config.teamClusterId,
            timestamp: new Date().toISOString(),
            connectedToCloud: this.connectedToCloud,
            details
        });
    }

    private readHealthcheckResponse(payload: unknown): ProcessTeamClusterHealthcheckOutputDTO {
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
            throw new Error('Unexpected healthcheck response');
        }

        const daemonPassword = Reflect.get(payload, 'daemonPassword');
        const teamCluster = Reflect.get(payload, 'teamCluster');
        if (typeof daemonPassword !== 'string' || typeof teamCluster !== 'object' || teamCluster === null || Array.isArray(teamCluster)) {
            throw new Error('Unexpected healthcheck response');
        }

        return {
            daemonPassword,
            teamCluster
        };
    }
}
