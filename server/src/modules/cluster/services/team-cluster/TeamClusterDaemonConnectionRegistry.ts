import { ErrorCodes } from '@core/constants/error-codes';
import DaemonChannelRegistry from '@modules/cluster/services/daemon/DaemonChannelRegistry';
import type { TeamClusterDaemonSocketChannel } from '@modules/cluster/socket/TeamClusterSocketProtocol';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';

export interface ReleasedDaemonConnection {
    teamClusterId: string;
    channel: TeamClusterDaemonSocketChannel;
    wasBound: boolean;
}

export default class TeamClusterDaemonConnectionRegistry {
    #channels = new Map<TeamClusterDaemonSocketChannel, DaemonChannelRegistry>();
    #teamClusterIdBySocketId = new Map<string, string>();
    #channelBySocketId = new Map<string, TeamClusterDaemonSocketChannel>();

    bind(socketId: string, teamClusterId: string, channel: TeamClusterDaemonSocketChannel): void {
        const registry = this.#registryFor(channel);
        registry.bind(teamClusterId, socketId);
        this.#teamClusterIdBySocketId.set(socketId, teamClusterId);
        this.#channelBySocketId.set(socketId, channel);
        registry.resolveWaiters(teamClusterId, socketId);
    }

    release(socketId: string): ReleasedDaemonConnection | null {
        const teamClusterId = this.#teamClusterIdBySocketId.get(socketId);
        const channel = this.#channelBySocketId.get(socketId);

        this.#teamClusterIdBySocketId.delete(socketId);
        this.#channelBySocketId.delete(socketId);

        if (!teamClusterId || !channel) {
            return null;
        }

        const registry = this.#registryFor(channel);
        const wasBound = registry.socketIdFor(teamClusterId) === socketId;
        if (wasBound) {
            registry.release(teamClusterId);
        }

        return {
            teamClusterId,
            channel,
            wasBound
        };
    }

    socketIdFor(teamClusterId: string, channel: TeamClusterDaemonSocketChannel): string | undefined {
        return this.#registryFor(channel).socketIdFor(teamClusterId);
    }

    teamClusterIdFor(socketId: string): string | undefined {
        return this.#teamClusterIdBySocketId.get(socketId);
    }

    isRegistered(socketId: string): boolean {
        return this.#teamClusterIdBySocketId.has(socketId);
    }

    hasConnection(teamClusterId: string, channel: TeamClusterDaemonSocketChannel): boolean {
        return this.#registryFor(channel).has(teamClusterId);
    }

    async requireSocketId(
        teamClusterId: string,
        channel: TeamClusterDaemonSocketChannel,
        waitTimeoutMs: number
    ): Promise<string> {
        const registry = this.#registryFor(channel);
        const socketId = registry.socketIdFor(teamClusterId);
        if (socketId) {
            return socketId;
        }

        logger.info(`[ReverseChannel] Waiting for daemon ${channel} reconnection: cluster=${teamClusterId}`);

        return new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => {
                registry.removeWaiter(teamClusterId, onConnected);

                reject(ApplicationError.conflict(
                    ErrorCodes.TEAM_CLUSTER_DAEMON_UNAVAILABLE,
                    `Team cluster daemon ${channel} reverse channel is not connected`
                ));
            }, waitTimeoutMs);

            const onConnected = (nextSocketId: string) => {
                clearTimeout(timeout);
                resolve(nextSocketId);
            };

            registry.addWaiter(teamClusterId, onConnected);
        });
    }

    #registryFor(channel: TeamClusterDaemonSocketChannel): DaemonChannelRegistry {
        const existing = this.#channels.get(channel);
        if (existing) {
            return existing;
        }

        const registry = new DaemonChannelRegistry();
        this.#channels.set(channel, registry);
        return registry;
    }
}
