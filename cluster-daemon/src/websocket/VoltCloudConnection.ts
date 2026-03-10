import { postJson } from '../utilities/http';
import { RuntimeLifecycleEventType } from '../contracts/events';
import {
    TEAM_CLUSTER_DAEMON_REGISTERED_EVENT,
    TEAM_CLUSTER_DAEMON_REGISTER_EVENT,
    type TeamClusterDaemonRegisterPayload
} from '../contracts/reverseChannel';
import { TeamClusterStatus, type ProcessTeamClusterHealthcheckOutputDTO } from './voltCloudTypes';
import { logger } from '../core/logger';
import { DAEMON_TOKENS } from '../core/tokens';
import { DockerRuntimeService } from '../infrastructure/docker/DockerRuntimeService';
import { RuntimeEventBroker } from '../infrastructure/RuntimeEventBroker';
import { MetricsService } from '../modules/metrics/MetricsService';
import { ReverseChannelSocketBridge } from './ReverseChannelSocketBridge';
import { inject, injectable } from 'tsyringe';
import { io, Socket } from 'socket.io-client';
import type { DaemonConfig } from '../core/config';
import type { MetricsSnapshot } from '../contracts/metrics';

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

@injectable()
export class VoltCloudConnection {
    private daemonPassword: string;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private controlSocket: Socket | null = null;
    private connectedToCloud = false;
    private latestLatencyMs: number | null = null;
    private stopped = false;
    private readonly baseReconnectDelayMs = 500;
    private readonly reverseChannelSocketBridge: ReverseChannelSocketBridge;
    private activeSocketId = 0;

    constructor(
        @inject(DAEMON_TOKENS.Config)
        private readonly config: DaemonConfig,
        @inject(DAEMON_TOKENS.MetricsService)
        private readonly metricsService: MetricsService,
        @inject(DAEMON_TOKENS.RuntimeEventBroker)
        private readonly eventBroker: RuntimeEventBroker,
        @inject(DAEMON_TOKENS.DockerRuntimeService)
        dockerRuntimeService: DockerRuntimeService
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
                logger.warn('Failed to send team cluster heartbeat');
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

        this.controlSocket?.removeAllListeners();
        this.controlSocket?.close();

        const socket = io(this.config.controlSocketUrl, {
            autoConnect: true,
            forceNew: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: this.baseReconnectDelayMs,
            randomizationFactor: 0.3
        });
        const socketId = ++this.activeSocketId;

        this.controlSocket = socket;

        socket.on('connect', () => {
            logger.info('Connected to VoltCloud');
            const payload: TeamClusterDaemonRegisterPayload = {
                teamClusterId: this.config.teamClusterId,
                daemonPassword: this.daemonPassword
            };

            socket.emit(TEAM_CLUSTER_DAEMON_REGISTER_EVENT, payload);
        });

        socket.on(TEAM_CLUSTER_DAEMON_REGISTERED_EVENT, () => {
            if (this.activeSocketId !== socketId) {
                return;
            }

            this.controlSocket = socket;
            this.emitLifecycle(RuntimeLifecycleEventType.CloudSocketConnected, 'Outbound cloud socket connected');
        });

        this.reverseChannelSocketBridge.bindToSocket(socket as unknown as {
            emit(event: string, payload: unknown): void;
            on(event: string, listener: (payload: never) => void): void;
        });

        socket.on('disconnect', (reason) => {
            if (this.activeSocketId !== socketId) {
                return;
            }

            if (this.controlSocket === socket) {
                this.controlSocket = null;
            }
            this.reverseChannelSocketBridge.cleanup();
            this.emitLifecycle(RuntimeLifecycleEventType.CloudSocketDisconnected, `Outbound cloud socket disconnected (${reason})`);
        });

        socket.on('connect_error', (error: Error) => {
            if (this.activeSocketId !== socketId) {
                return;
            }

            logger.error(`Outbound cloud socket connection error, will retry in ${this.baseReconnectDelayMs} ms`);
            logger.debug({ err: error }, 'Outbound cloud socket connect_error details');
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
};
