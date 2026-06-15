import { Service } from '@/core/decorators/service';
import { logger } from '@/core/logger';
import type { DaemonConfig } from '@/core/config';
import type { TeamClusterDaemonRuntimeConfig } from '@/core/runtime/contracts/team-cluster-runtime';
import type { TeamClusterDaemonMessage } from '@voltstack/daemon-cluster-client';
import { ControlPlaneProcessClient } from '@/modules/container/infrastructure/connection/ControlPlaneProcessClient';
import { TeamClusterStatus } from '@/modules/container/contracts/container-types';

interface RuntimeLifecycleUpdateRequest {
    teamClusterId: string;
    daemonPassword: string;
    status: TeamClusterStatus;
};

type CommandlessTeamClusterDaemonMessage = Exclude<TeamClusterDaemonMessage, { type: 'command' }>;

@Service('voltCloudConnection')
export class VoltCloudConnection {
    private connectedToCloud = false;
    private heartbeatFailureCount = 0;

    public readonly client: ControlPlaneProcessClient;

    constructor(
        private readonly config: DaemonConfig
    ) {
        this.client = new ControlPlaneProcessClient(config);

        this.client
            .onConnected(() => {
                this.connectedToCloud = true;
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

    emitMessage(message: CommandlessTeamClusterDaemonMessage): void {
        try {
            this.client.emit(message as unknown as TeamClusterDaemonMessage);
        } catch (err) {
            logger.warn(`Failed to emit message to VoltCloud: ${err instanceof Error ? err.message : String(err)}`);
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
            logger.warn(`Failed to send lifecycle status to VoltCloud: status=${TeamClusterStatus.DeleteFailed}, durationMs=${Date.now() - startedAt}, error=${error instanceof Error ? error.message : String(error)}`);
        }
    }

    sendServerCommand<TResponse = object>(command: string, payload: object): Promise<TResponse | undefined> {
        return this.client.sendCommand<TResponse>(command, payload);
    }

    async getRuntimeConfig(): Promise<TeamClusterDaemonRuntimeConfig> {
        const runtimeConfig = await this.sendServerCommand<TeamClusterDaemonRuntimeConfig>(
            'runtime.config.get',
            {}
        );
        if (!runtimeConfig) {
            throw new Error('VoltCloud returned an empty runtime config payload');
        }

        return runtimeConfig;
    }
};
