import { logger } from '@/core/logger';
import { OrchestrationAction } from '@/shared/contracts';
import { MetricsService } from '@/modules/metrics/services';
import { RuntimeEventBroker } from '@/shared/services';
import {
    ClusterDaemonClient,
    DaemonClientError
} from '@voltstack/daemon-cluster-client';
import type { DaemonConfig } from '@/core/config';
import type {
    RuntimeLifecycleEvent,
    RuntimeLifecycleEventType,
    TeamClusterDaemonMessage
} from '@voltstack/daemon-cluster-client';
import { TeamClusterStatus } from '../contracts/voltCloudTypes';

interface RuntimeLifecycleUpdateRequest {
    teamClusterId: string;
    daemonPassword: string;
    status: TeamClusterStatus;
    installedVersion?: string;
};

interface DeleteCompletionRequest {
    teamClusterId: string;
    daemonPassword: string;
};

type NonCommandMessage = Exclude<TeamClusterDaemonMessage, { type: 'command' }>;

/**
 * Adapter that wraps `ClusterDaemonClient` to provide the lifecycle and
 * reporting API consumed by the rest of the daemon modules.
 *
 * Internal communication (enrollment, socket, heartbeat) is fully delegated to
 * `ClusterDaemonClient`. This class only adds daemon-specific concerns:
 * metrics collection for heartbeat payloads, lifecycle event emission to
 * `RuntimeEventBroker`, and the higher-level reporting helpers.
 */
export class VoltCloudConnection {
    private connectedToCloud = false;

    readonly client: ClusterDaemonClient;

    constructor(
        private readonly config: DaemonConfig,
        private readonly metricsService: MetricsService,
        private readonly eventBroker: RuntimeEventBroker
    ) {
        this.client = new ClusterDaemonClient({
            serverUrl: config.voltCloudUrl,
            controlSocketUrl: config.controlSocketUrl ?? config.voltCloudUrl,
            credentials: {
                teamClusterId: config.teamClusterId,
                daemonPassword: config.daemonPassword,
                enrollmentToken: config.enrollmentToken,
                installedVersion: config.installedVersion
            },
            enrollment: config.healthcheckPath
                ? { url: `${config.voltCloudUrl}${config.healthcheckPath}` }
                : { enabled: false, url: '' },
            heartbeat: {
                interval: config.heartbeatIntervalMs,
                payloadFactory: async () => ({
                    teamClusterId: this.client.getTeamClusterId(),
                    daemonPassword: this.client.getDaemonPassword(),
                    installedVersion: config.installedVersion,
                    metrics: await this.metricsService.collectSnapshot({
                        cloudLatencyMs: null,
                        connectedToCloud: this.connectedToCloud
                    })
                })
            },
            socket: {
                reconnect: true,
                maxReconnectAttempts: Infinity,
                reconnectBaseDelayMs: 500,
                reconnectMaxDelayMs: 30_000,
                randomizationFactor: 0.3
            },
            commandTimeout: 30_000
        });

        this.client
            .onConnected(() => {
                this.connectedToCloud = true;
                this.emitLifecycleEvent('cloud-socket-connected', 'Outbound cloud socket connected');
                logger.info('Connected to VoltCloud');
            })
            .onDisconnected((reason) => {
                this.connectedToCloud = false;
                this.emitLifecycleEvent('cloud-socket-disconnected', `Outbound cloud socket disconnected (${reason})`);
            })
            .onError((err: DaemonClientError) => {
                if (err.message.includes('heartbeat')) {
                    this.connectedToCloud = false;
                    this.emitLifecycleEvent('heartbeat-failed', err.message);
                    logger.warn(`Heartbeat failed: ${err.message}`);
                    return;
                }

                logger.error({ err }, 'VoltCloudConnection error');
            });

        this.eventBroker.onProgress((event) => {
            if (event.action !== OrchestrationAction.ContainerCreate) {
                return;
            }

            this.emitMessage({
                type: 'runtime-progress',
                action: event.action,
                stage: event.stage,
                timestamp: event.timestamp,
                payload: event.payload
            } as unknown as NonCommandMessage);
        });
    }

    async start(): Promise<void> {
        this.emitLifecycleEvent('starting', 'Cluster daemon starting');
        await this.client.connect();
    }

    stop(): void {
        this.client.disconnect();
    }

    isConnectedToCloud(): boolean {
        return this.connectedToCloud;
    }

    getTeamClusterId(): string {
        return this.client.getTeamClusterId();
    }

    getDaemonPassword(): string {
        return this.client.getDaemonPassword();
    }

    /**
     * Emits a fire-and-forget message on the control socket.
     * Use this instead of the old `getControlSocket().emit(...)` pattern.
     */
    emitMessage(message: NonCommandMessage): void {
        try {
            this.client.emit(message);
        } catch (err: unknown) {
            logger.warn({ err }, 'Failed to emit message to VoltCloud');
        }
    }

    async reportDeleteFailed(details: string): Promise<void> {
        await this.sendLifecycleStatus(TeamClusterStatus.DeleteFailed, details);
    }

    async reportUpdateFailed(details: string): Promise<void> {
        await this.sendLifecycleStatus(TeamClusterStatus.UpdateFailed, details);
    }

    async reportDeleting(details: string): Promise<void> {
        await this.sendLifecycleStatus(TeamClusterStatus.Deleting, details);
    }

    async reportDisconnected(details: string): Promise<void> {
        await this.sendLifecycleStatus(TeamClusterStatus.Disconnected, details);
    }

    async reportDeleteCompleted(details: string): Promise<void> {
        if (!this.client.isReady()) {
            return;
        }

        try {
            const request: DeleteCompletionRequest = {
                teamClusterId: this.client.getTeamClusterId(),
                daemonPassword: this.client.getDaemonPassword()
            };
            await this.sendServerCommand('runtime.delete-completed', request);
        } catch (error: unknown) {
            logger.warn({ err: error, details }, 'Failed to report completed team cluster deletion to VoltCloud');
        }
    }

    async sendServerCommand<T>(command: string, payload: object): Promise<T | undefined> {
        return this.client.sendCommand<T>(command, payload);
    }

    emitLifecycleEvent(type: RuntimeLifecycleEventType, details?: string): void {
        this.eventBroker.emitLifecycle(this.createLifecycleEvent(type, details));
    }

    private async sendLifecycleStatus(status: TeamClusterStatus, details: string): Promise<void> {
        try {
            const requestBody: RuntimeLifecycleUpdateRequest = {
                teamClusterId: this.client.getTeamClusterId(),
                daemonPassword: this.client.getDaemonPassword(),
                status,
                installedVersion: this.config.installedVersion
            };

            await this.sendServerCommand('runtime.lifecycle', requestBody);
            this.emitLifecycleEvent('services-ready', details);
        } catch (error: unknown) {
            logger.warn({ err: error, status }, 'Failed to send lifecycle status to VoltCloud');
        }
    }

    private createLifecycleEvent(type: RuntimeLifecycleEventType, details?: string): RuntimeLifecycleEvent {
        return {
            type,
            teamClusterId: this.client.getTeamClusterId(),
            timestamp: new Date().toISOString(),
            connectedToCloud: this.connectedToCloud,
            details
        };
    }
};
