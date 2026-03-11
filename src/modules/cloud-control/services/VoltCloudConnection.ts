import { logger } from '@/core/logger';
import { MetricsService } from '@/modules/metrics/services';
import { EventType, REVERSE_CHANNEL } from '@/shared/contracts';
import { RuntimeEventBroker } from '@/shared/services';
import crypto from 'node:crypto';
import { io, Socket } from 'socket.io-client';
import type { DaemonConfig } from '@/core/config';
import type { MetricsSnapshot, RuntimeLifecycleEventType, TeamClusterDaemonRegisterPayload, TeamClusterDaemonSocketResponsePayload } from '@/shared/contracts';
import type { ReverseChannelSocketBridge } from './ReverseChannelSocketBridge';
import { TeamClusterStatus } from '../contracts/voltCloudTypes';
import type { ProcessTeamClusterHealthcheckOutputDTO } from '../contracts/voltCloudTypes';

interface RuntimeLifecycleUpdateRequest {
    teamClusterId: string;
    daemonPassword: string;
    status: TeamClusterStatus;
    installedVersion?: string;
};

interface HeartbeatRequest {
    teamClusterId: string;
    daemonPassword: string;
    installedVersion?: string;
    metrics?: MetricsSnapshot;
};

interface DeleteCompletionRequest {
    teamClusterId: string;
    daemonPassword: string;
};

interface CommandResponseEnvelope<T> {
    status: string;
    data: T;
};

export class VoltCloudConnection {
    private daemonPassword: string;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private controlSocket: Socket | null = null;
    private controlSocketRegistered = false;
    private connectedToCloud = false;
    private latestLatencyMs: number | null = null;
    private stopped = false;
    private readonly baseReconnectDelayMs = 500;
    private activeSocketId = 0;

    constructor(
        private readonly config: DaemonConfig,
        private readonly metricsService: MetricsService,
        private readonly eventBroker: RuntimeEventBroker,
        private readonly reverseChannelSocketBridge: ReverseChannelSocketBridge
    ) {
        this.daemonPassword = config.daemonPassword;
    }

    async start(): Promise<void> {
        await this.authenticate();
        this.emitLifecycle('starting', 'Cluster daemon starting');
        await this.connectControlSocket();
        this.startHeartbeatLoop();
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

    getTeamClusterId(): string {
        return this.config.teamClusterId;
    }

    getDaemonPassword(): string {
        return this.daemonPassword;
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
        if (!this.controlSocket) {
            return;
        }

        try {
            await this.sendServerCommand('runtime.delete-completed', {
                teamClusterId: this.config.teamClusterId,
                daemonPassword: this.daemonPassword
            } satisfies DeleteCompletionRequest as unknown as Record<string, unknown>);
        } catch (error: unknown) {
            logger.warn({ err: error, details }, 'Failed to report completed team cluster deletion to VoltCloud');
        }
    }

    private async authenticate(): Promise<void> {
        if (!this.config.enrollmentToken || !this.config.healthcheckPath) {
            return;
        }

        const response = await fetch(`${this.config.voltCloudUrl}${this.config.healthcheckPath}`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                enrollmentToken: this.config.enrollmentToken,
                installedVersion: this.config.installedVersion
            })
        });
        const payload = await response.json();
        if (!response.ok || !payload || typeof payload !== 'object' || !('data' in payload)) {
            throw new Error('Unexpected healthcheck response');
        }

        const parsed = this.readHealthcheckResponse((payload as { data: unknown }).data);
        this.daemonPassword = parsed.daemonPassword;
    }

    private startHeartbeatLoop(): void {
        const sendHeartbeat = async () => {
            const startTime = Date.now();
            try {
                const requestBody: HeartbeatRequest = {
                    teamClusterId: this.config.teamClusterId,
                    daemonPassword: this.daemonPassword,
                    installedVersion: this.config.installedVersion,
                    metrics: await this.metricsService.collectSnapshot()
                };

                await this.sendServerCommand('runtime.heartbeat', requestBody as unknown as Record<string, unknown>);
                this.latestLatencyMs = Date.now() - startTime;
                this.connectedToCloud = true;
                this.metricsService.updateCloudLatency(this.latestLatencyMs);
                this.metricsService.updateCloudConnectionState(true);
                this.emitLifecycle('heartbeat-succeeded', `Heartbeat latency ${this.latestLatencyMs}ms`);
            } catch (error: unknown) {
                const details = error instanceof Error ? error.message : String(error);
                this.connectedToCloud = false;
                this.latestLatencyMs = null;
                this.metricsService.updateCloudLatency(null);
                this.metricsService.updateCloudConnectionState(false);
                this.emitLifecycle('heartbeat-failed', details);
                logger.warn('Failed to send team cluster heartbeat: ' + error);
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

    private connectControlSocket(): Promise<void> {
        if (!this.config.controlSocketUrl) {
            return Promise.resolve();
        }

        this.controlSocketRegistered = false;
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

        return new Promise<void>((resolve, reject) => {
            let resolved = false;

            socket.on('connect', () => {
                logger.info('Connected to VoltCloud');
                const payload: TeamClusterDaemonRegisterPayload = {
                    teamClusterId: this.config.teamClusterId,
                    daemonPassword: this.daemonPassword
                };

                socket.emit(EventType.TeamClusterDaemonRegister, payload);
            });

            socket.on(EventType.TeamClusterDaemonRegistered, () => {
                if (this.activeSocketId !== socketId) {
                    return;
                }

                this.controlSocketRegistered = true;
                this.controlSocket = socket;
                this.emitLifecycle('cloud-socket-connected', 'Outbound cloud socket connected');

                if (!resolved) {
                    resolved = true;
                    resolve();
                }
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
                this.controlSocketRegistered = false;
                this.reverseChannelSocketBridge.cleanup();
                this.emitLifecycle('cloud-socket-disconnected', `Outbound cloud socket disconnected (${reason})`);
            });

            socket.on('connect_error', (error: Error) => {
                if (this.activeSocketId !== socketId) {
                    return;
                }

                logger.error(`Outbound cloud socket connection error, will retry in ${this.baseReconnectDelayMs} ms`);
                logger.debug({ err: error }, 'Outbound cloud socket connect_error details');

                if (!resolved) {
                    resolved = true;
                    reject(error);
                }
            });
        });
    }

    private async sendLifecycleStatus(status: TeamClusterStatus, details: string): Promise<void> {
        try {
            const requestBody: RuntimeLifecycleUpdateRequest = {
                teamClusterId: this.config.teamClusterId,
                daemonPassword: this.daemonPassword,
                status,
                installedVersion: this.config.installedVersion
            };

            await this.sendServerCommand('runtime.lifecycle', requestBody as unknown as Record<string, unknown>);
            this.emitLifecycle('services-ready', details);
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

    async sendServerCommand<T>(command: string, payload: Record<string, unknown>): Promise<T | undefined> {
        if (!this.controlSocket) {
            throw new Error('VoltCloud control socket is not connected');
        }

        if (!this.controlSocketRegistered) {
            throw new Error('VoltCloud control socket is not registered yet');
        }

        const requestId = crypto.randomUUID();

        return new Promise<T | undefined>((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.controlSocket?.off(EventType.TeamClusterDaemonMessage, onMessage);
                reject(new Error(`Timed out waiting for response to ${command}`));
            }, 30_000);

            const onMessage = (message: unknown) => {
                if (typeof message !== 'object' || message === null || Array.isArray(message)) {
                    return;
                }

                const typedMessage = message as TeamClusterDaemonSocketResponsePayload<CommandResponseEnvelope<T>>;
                if (typedMessage.type !== 'response' || typedMessage.requestId !== requestId) {
                    return;
                }

                clearTimeout(timeout);
                this.controlSocket?.off(EventType.TeamClusterDaemonMessage, onMessage);

                if (!typedMessage.ok) {
                    reject(new Error(typedMessage.message || `Socket command failed: ${command}`));
                    return;
                }

                resolve(typedMessage.data?.data);
            };

            this.controlSocket?.on(EventType.TeamClusterDaemonMessage, onMessage);
            this.controlSocket?.emit(EventType.TeamClusterDaemonMessage, {
                type: 'command',
                requestId,
                command,
                responseType: REVERSE_CHANNEL.ResponseType.Json,
                payload
            });
        });
    }
};
