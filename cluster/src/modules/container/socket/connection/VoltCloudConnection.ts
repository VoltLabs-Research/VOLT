import { errorMessage } from '@shared/application/utilities/error-message';
import { singleton } from '@shared/application/utilities/singleton';
import { getConfig } from '@core/config/daemon';
import { logger } from '@shared/infrastructure/logger';
import type { DaemonConfig } from '@core/config/daemon';
import type { TeamClusterDaemonRuntimeConfig } from '@shared/contracts/types/team-cluster-runtime';
import type { ReverseChannelOutboundMessage } from '@shared/contracts/channel/binary-messages';
import { ControlPlaneProcessClient } from '@modules/container/socket/connection/ControlPlaneProcessClient';
import { TeamClusterStatus } from '@shared/contracts/types/container-types';

interface RuntimeLifecycleUpdateRequest {
    teamClusterId: string;
    daemonPassword: string;
    status: TeamClusterStatus;
};

export class VoltCloudConnection {
    private connectedToCloud = false;
    private heartbeatFailureCount = 0;
    private connectionGeneration = 0;

    public readonly client: ControlPlaneProcessClient;

    constructor(
        config: DaemonConfig
    ) {
        this.client = new ControlPlaneProcessClient(config);

        this.client
            .onConnected(() => {
                this.connectedToCloud = true;
                this.connectionGeneration += 1;
                this.heartbeatFailureCount = 0;
                logger.info('Connected to VoltCloud');
            })
            .onDisconnected((reason) => {
                this.connectedToCloud = false;
                this.heartbeatFailureCount = 0;
                logger.info(`Outbound cloud socket disconnected (${reason})`);
            })
            .onError((err: Error) => {
                if (err.message.includes('heartbeat')) {
                    this.heartbeatFailureCount += 1;
                    logger.warn(`Heartbeat failed: ${err.message} (heartbeatFailureCount=${this.heartbeatFailureCount}, socketReady=${this.client.isReady()})`);
                    return;
                }

                logger.error(`VoltCloudConnection error: ${err.message}`);
            });
    }

    async start(): Promise<void> {
        await this.client.connect();
    }

    stop(): void {
        this.client.disconnect();
    }

    isConnectedToCloud(): boolean {
        return this.connectedToCloud;
    }

    getConnectionGeneration(): number {
        return this.connectionGeneration;
    }

    emitMessage(message: ReverseChannelOutboundMessage): void {
        try {
            this.client.emit(message);
        } catch (err) {
            logger.warn(`Failed to emit ${message.type} message to VoltCloud: ${errorMessage(err)}`);
        }
    }

    async reportDeleteFailed(_details?: string): Promise<void> {
        const startedAt = Date.now();

        try {
            await this.client.sendCommand('runtime.lifecycle', {
                teamClusterId: this.client.getTeamClusterId(),
                daemonPassword: this.client.getDaemonPassword(),
                status: TeamClusterStatus.DeleteFailed
            } satisfies RuntimeLifecycleUpdateRequest);
            logger.info(`Reported daemon lifecycle status to VoltCloud: status=${TeamClusterStatus.DeleteFailed}, durationMs=${Date.now() - startedAt}`);
        } catch (error) {
            logger.warn(`Failed to send lifecycle status to VoltCloud: status=${TeamClusterStatus.DeleteFailed}, durationMs=${Date.now() - startedAt}, error=${errorMessage(error)}`);
        }
    }

    async getRuntimeConfig(): Promise<TeamClusterDaemonRuntimeConfig> {
        const runtimeConfig = await this.client.sendCommand<TeamClusterDaemonRuntimeConfig>(
            'runtime.config.get',
            {}
        );
        if (!runtimeConfig) {
            throw new Error('VoltCloud returned an empty runtime config payload');
        }

        return runtimeConfig;
    }
};

export const getVoltCloudConnection = singleton((): VoltCloudConnection => new VoltCloudConnection(getConfig()));
