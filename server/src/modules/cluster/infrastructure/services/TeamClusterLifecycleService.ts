import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import type { SystemMetrics } from '@modules/system/domain/value-objects/SystemMetrics';
import SystemMetricsRedisRepository from '@modules/system/infrastructure/persistence/redis/SystemMetricsRedisRepository';
import type { TeamClusterHeartbeatMetricsDTO } from '@modules/cluster/application/dtos/RecordTeamClusterHeartbeatDTO';
import { TeamClusterDTO, toTeamClusterDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';
import TeamCluster, {
    TeamClusterRuntimeRoleConfigProps,
    TeamClusterStatus
} from '@modules/cluster/domain/entities/TeamCluster';
import FirstTeamClusterConnectedEvent from '@modules/cluster/domain/events/FirstTeamClusterConnectedEvent';
import type { TeamClusterLifecycleUpdatePreconditions } from '@modules/cluster/domain/port/ITeamClusterRepository';
import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import {
    TEAM_CLUSTER_METRICS_ALL_EVENT,
    toTeamClusterClientMetrics
} from '@modules/cluster/utilities/teamClusterMetricsSocket';
import { getTeamClusterRoom, TEAM_CLUSTER_LIFECYCLE_EVENT } from '@modules/cluster/utilities/teamClusterSocket';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import DaemonCredentialGuard from '@shared/application/team-cluster/DaemonCredentialGuard';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject } from 'tsyringe';

const BYTES_PER_GB = 1024 ** 3;
const TEAM_CLUSTER_ALLOWED_TRANSITIONS: Record<TeamClusterStatus, ReadonlySet<TeamClusterStatus>> = {
    [TeamClusterStatus.WaitingForConnection]: new Set([
        TeamClusterStatus.HealthcheckReceived,
        TeamClusterStatus.Connected,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.HealthcheckReceived]: new Set([
        TeamClusterStatus.HealthcheckReceived,
        TeamClusterStatus.PreparingEnvironment,
        TeamClusterStatus.Connected,
        TeamClusterStatus.DependenciesInstallationFailed,
        TeamClusterStatus.OperatingSystemNotSupported,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.PreparingEnvironment]: new Set([
        TeamClusterStatus.PreparingEnvironment,
        TeamClusterStatus.Connected,
        TeamClusterStatus.DependenciesInstallationFailed,
        TeamClusterStatus.OperatingSystemNotSupported,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.DependenciesInstallationFailed]: new Set([
        TeamClusterStatus.HealthcheckReceived,
        TeamClusterStatus.PreparingEnvironment,
        TeamClusterStatus.DependenciesInstallationFailed,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.OperatingSystemNotSupported]: new Set([
        TeamClusterStatus.HealthcheckReceived,
        TeamClusterStatus.PreparingEnvironment,
        TeamClusterStatus.OperatingSystemNotSupported,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.Connected]: new Set([
        TeamClusterStatus.Connected,
        TeamClusterStatus.Disconnected,
        TeamClusterStatus.Updating,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.Disconnected]: new Set([
        TeamClusterStatus.HealthcheckReceived,
        TeamClusterStatus.PreparingEnvironment,
        TeamClusterStatus.DependenciesInstallationFailed,
        TeamClusterStatus.OperatingSystemNotSupported,
        TeamClusterStatus.Connected,
        TeamClusterStatus.Disconnected,
        TeamClusterStatus.Updating,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.Deleting]: new Set([
        TeamClusterStatus.Deleting,
        TeamClusterStatus.DeleteFailed
    ]),
    [TeamClusterStatus.DeleteFailed]: new Set([
        TeamClusterStatus.DeleteFailed,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.Updating]: new Set([
        TeamClusterStatus.Updating,
        TeamClusterStatus.Connected,
        TeamClusterStatus.UpdateFailed,
        TeamClusterStatus.Deleting
    ]),
    [TeamClusterStatus.UpdateFailed]: new Set([
        TeamClusterStatus.UpdateFailed,
        TeamClusterStatus.Updating,
        TeamClusterStatus.Connected,
        TeamClusterStatus.Deleting
    ])
};

const HEARTBEAT_LOCKED_STATUSES = new Set<TeamClusterStatus>([
    TeamClusterStatus.Deleting,
    TeamClusterStatus.DeleteFailed,
    TeamClusterStatus.Updating,
    TeamClusterStatus.UpdateFailed
]);

interface TeamClusterLifecycleUpdate {
    status: TeamClusterStatus;
    installedVersion?: string;
    lastHeartbeatAt?: Date | null;
    lastDisconnectAt?: Date | null;
    clearEnrollmentToken?: boolean;
    roleConfig?: TeamClusterRuntimeRoleConfigProps;
}

interface PersistLifecycleUpdateOptions {
    preconditions?: TeamClusterLifecycleUpdatePreconditions;
    logContext?: string;
}

interface TeamClusterLifecycleEventPayload {
    teamClusterId: string;
    teamId: string;
    deleted: boolean;
    teamCluster?: TeamClusterDTO;
    status?: TeamClusterStatus;
    timestamp: string;
}

@Singleton()
export default class TeamClusterLifecycleService {
    constructor(
        private readonly daemonCredentialGuard: DaemonCredentialGuard,
        private readonly teamClusterRepository: TeamClusterRepository,
        private readonly socketEmitter: SocketIOEmitter,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,
        private readonly systemMetricsRepository: SystemMetricsRedisRepository
    ){}

    async processHealthcheck(teamClusterId: string, enrollmentToken: string, installedVersion?: string): Promise<{
        teamCluster: TeamClusterDTO;
        daemonPassword: string;
    }> {
        const teamCluster = await this.daemonCredentialGuard.requireByEnrollment(teamClusterId, enrollmentToken);
        const daemonPassword = await this.daemonCredentialGuard.getDecryptedDaemonPassword(teamCluster);
        const updatedTeamCluster = await this.persistLifecycleUpdate(teamCluster, {
            status: TeamClusterStatus.HealthcheckReceived,
            installedVersion,
            clearEnrollmentToken: true
        }, {
            preconditions: {
                allowedCurrentStatuses: [teamCluster.props.status]
            },
            logContext: 'healthcheck'
        });

        return {
            teamCluster: toTeamClusterDTO(updatedTeamCluster),
            daemonPassword
        };
    }

    async updateLifecycleStatus(
        teamClusterId: string,
        daemonPassword: string,
        status: TeamClusterStatus,
        installedVersion?: string
    ): Promise<TeamClusterDTO> {
        const teamCluster = await this.daemonCredentialGuard.requireByDaemonPassword(teamClusterId, daemonPassword);

        const updatedTeamCluster = await this.persistLifecycleUpdate(teamCluster, {
            status,
            installedVersion,
            lastDisconnectAt: status === TeamClusterStatus.Disconnected ? new Date() : undefined
        }, {
            preconditions: {
                allowedCurrentStatuses: [teamCluster.props.status]
            },
            logContext: 'lifecycle-status'
        });

        return toTeamClusterDTO(updatedTeamCluster);
    }

    async recordHeartbeat(
        teamClusterId: string,
        daemonPassword: string,
        installedVersion?: string,
        runtime?: {
            roleConfig: TeamClusterRuntimeRoleConfigProps;
        },
        metrics?: TeamClusterHeartbeatMetricsDTO
    ): Promise<TeamClusterDTO> {
        const teamCluster = await this.daemonCredentialGuard.requireByDaemonPassword(teamClusterId, daemonPassword);
        const isFirstTeamConnection = teamCluster.props.lastHeartbeatAt === null
            && !(await this.teamClusterRepository.hasTeamEverConnected(teamCluster.props.team));
        const updatedTeamCluster = await this.persistLifecycleUpdate(teamCluster, {
            status: teamCluster.props.status,
            installedVersion,
            lastHeartbeatAt: new Date(),
            roleConfig: runtime?.roleConfig
        }, {
            preconditions: {
                allowedCurrentStatuses: [teamCluster.props.status]
            },
            logContext: 'heartbeat'
        });

        if (isFirstTeamConnection) {
            await this.eventBus.publish(new FirstTeamClusterConnectedEvent({
                teamId: updatedTeamCluster.props.team,
                teamClusterId: updatedTeamCluster.id
            }));
        }

        if (metrics) {
            const systemMetrics = this.toSystemMetrics(updatedTeamCluster.id, metrics);

            void this.systemMetricsRepository.save(systemMetrics).catch(() => {
                logger.warn(`Failed to persist system metrics snapshot after heartbeat acknowledgement teamClusterId=${updatedTeamCluster.id}`);
            });

            this.emitMetricsUpdate(updatedTeamCluster, systemMetrics);
        }

        return toTeamClusterDTO(updatedTeamCluster);
    }

    async markDaemonConnected(teamClusterId: string): Promise<TeamClusterDTO> {
        const teamCluster = await this.requireTeamClusterById(teamClusterId);
        const nextStatus = HEARTBEAT_LOCKED_STATUSES.has(teamCluster.props.status)
            ? teamCluster.props.status
            : TeamClusterStatus.Connected;
        const updatedTeamCluster = await this.persistLifecycleUpdate(teamCluster, {
            status: nextStatus,
            lastHeartbeatAt: new Date(),
            lastDisconnectAt: null
        }, {
            preconditions: {
                allowedCurrentStatuses: [teamCluster.props.status]
            },
            logContext: 'daemon-socket-connected'
        });

        return toTeamClusterDTO(updatedTeamCluster);
    }

    async markDaemonDisconnected(teamClusterId: string): Promise<TeamClusterDTO> {
        const teamCluster = await this.requireTeamClusterById(teamClusterId);
        const nextStatus = HEARTBEAT_LOCKED_STATUSES.has(teamCluster.props.status)
            ? teamCluster.props.status
            : teamCluster.props.status === TeamClusterStatus.Connected
                ? TeamClusterStatus.Disconnected
                : teamCluster.props.status;
        const updatedTeamCluster = await this.persistLifecycleUpdate(teamCluster, {
            status: nextStatus,
            lastDisconnectAt: new Date()
        }, {
            preconditions: {
                allowedCurrentStatuses: [teamCluster.props.status]
            },
            logContext: 'daemon-socket-disconnected'
        });

        return toTeamClusterDTO(updatedTeamCluster);
    }

    private toSystemMetrics(teamClusterId: string, metrics: TeamClusterHeartbeatMetricsDTO): SystemMetrics {
        const timestamp = new Date(metrics.timestamp);
        const safeTimestamp = Number.isNaN(timestamp.getTime()) ? new Date() : timestamp;

        return {
            timestamp: safeTimestamp,
            serverId: metrics.hostname,
            teamClusterId,
            cpu: {
                usage: metrics.cpuUsagePercent,
                cores: metrics.cpuPerCoreUsagePercent.length,
                loadAvg: metrics.cpuLoadAverage,
                coresUsage: metrics.cpuPerCoreUsagePercent
            },
            memory: {
                total: metrics.memory.totalBytes / BYTES_PER_GB,
                used: metrics.memory.usedBytes / BYTES_PER_GB,
                free: metrics.memory.freeBytes / BYTES_PER_GB,
                usagePercent: metrics.memory.usagePercent
            },
            disk: {
                total: metrics.disk.totalBytes / BYTES_PER_GB,
                used: metrics.disk.usedBytes / BYTES_PER_GB,
                free: metrics.disk.freeBytes / BYTES_PER_GB,
                usagePercent: metrics.disk.usagePercent
            },
            network: {
                incoming: metrics.network.incomingKilobytesPerSecond,
                outgoing: metrics.network.outgoingKilobytesPerSecond,
                total: metrics.network.totalKilobytesPerSecond
            },
            responseTime: metrics.cloudLatencyMs ?? 0,
            responseTimes: {
                mongodb: 0,
                redis: 0,
                minio: 0,
                self: metrics.cloudLatencyMs ?? 0,
                average: metrics.cloudLatencyMs ?? 0
            },
            diskOperations: {
                read: metrics.diskOperations.readMegabytesPerSecond,
                write: metrics.diskOperations.writeMegabytesPerSecond,
                speed: metrics.diskOperations.totalIOPS,
                readIOPS: metrics.diskOperations.readIOPS,
                writeIOPS: metrics.diskOperations.writeIOPS
            },
            status: metrics.cpuUsagePercent >= 90 || metrics.memory.usagePercent >= 90 || metrics.disk.usagePercent >= 90
                ? 'Critical'
                : metrics.cpuUsagePercent >= 75 || metrics.memory.usagePercent >= 75 || metrics.disk.usagePercent >= 85
                    ? 'Warning'
                    : 'Healthy',
            uptime: metrics.uptimeSeconds,
            mongodb: {
                connections: 0,
                queries: 0,
                latency: 0
            }
        };
    }

    async authenticateDaemonConnection(teamClusterId: string, daemonPassword: string): Promise<void> {
        await this.daemonCredentialGuard.requireByDaemonPassword(teamClusterId, daemonPassword);
    }

    async markDeleting(teamClusterId: string): Promise<TeamClusterDTO> {
        const teamCluster = await this.requireTeamClusterById(teamClusterId);
        const updatedTeamCluster = await this.persistLifecycleUpdate(teamCluster, {
            status: TeamClusterStatus.Deleting
        }, {
            preconditions: {
                allowedCurrentStatuses: [teamCluster.props.status]
            },
            logContext: 'mark-deleting'
        });

        return toTeamClusterDTO(updatedTeamCluster);
    }

    async completeDeletion(teamClusterId: string, daemonPassword: string): Promise<void> {
        const teamCluster = await this.daemonCredentialGuard.requireByDaemonPassword(teamClusterId, daemonPassword);
        await this.deleteTeamCluster(teamCluster);
    }

    private async countTrue<T>(items: T[], apply: (item: T) => Promise<boolean>): Promise<number> {
        const outcomes = await Promise.all(items.map(apply));
        return outcomes.filter(Boolean).length;
    }

    async finalizeDeletingClustersByEvidence(cutoff: Date): Promise<number> {
        const deletingClusters = await this.teamClusterRepository.findDeletingClustersDisconnectedBefore(cutoff);

        return this.countTrue(deletingClusters, async (teamCluster) => {
            const currentTeamCluster = await this.requireTeamClusterById(teamCluster.id);
            if (currentTeamCluster.props.status !== TeamClusterStatus.Deleting) return false;
            if (currentTeamCluster.props.lastDisconnectAt === null || currentTeamCluster.props.lastDisconnectAt >= cutoff) return false;

            await this.deleteTeamCluster(currentTeamCluster);
            logger.info(`Team cluster deletion completed after runtime disconnect evidence teamClusterId=${teamCluster.id} teamId=${teamCluster.props.team} lastDisconnectAt=${teamCluster.props.lastDisconnectAt}`);
            return true;
        });
    }

    async markDeletingTimeouts(cutoff: Date): Promise<number> {
        const timedOutClusters = await this.teamClusterRepository.findDeletingTimedOutClusters(cutoff);

        return this.countTrue(timedOutClusters, async (teamCluster) => {
            const updatedTeamCluster = await this.persistLifecycleUpdate(teamCluster, {
                status: TeamClusterStatus.DeleteFailed
            }, {
                preconditions: {
                    allowedCurrentStatuses: [TeamClusterStatus.Deleting],
                    requireUpdatedBefore: cutoff
                },
                logContext: 'delete-timeout'
            });

            if (updatedTeamCluster.props.status !== TeamClusterStatus.DeleteFailed) return false;
            if (updatedTeamCluster.props.updatedAt.getTime() <= teamCluster.props.updatedAt.getTime()) return false;

            logger.warn(`Team cluster marked as delete-failed after delete timeout teamClusterId=${teamCluster.id} teamId=${teamCluster.props.team}`);
            return true;
        });
    }

    async deleteTeamCluster(teamCluster: TeamCluster): Promise<void> {
        const deleted = await this.teamClusterRepository.deleteById(teamCluster.id);
        if (!deleted) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }

        this.emitLifecycleDeletion(teamCluster);
    }

    publishTeamClusterUpdate(teamCluster: TeamCluster): void {
        this.emitLifecycleUpdate(teamCluster);
    }

    private async requireTeamClusterById(teamClusterId: string): Promise<TeamCluster> {
        const teamCluster = await this.teamClusterRepository.findById(teamClusterId);
        if (!teamCluster) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }

        return teamCluster;
    }

    private async persistLifecycleUpdate(
        teamCluster: TeamCluster,
        update: TeamClusterLifecycleUpdate,
        options: PersistLifecycleUpdateOptions = {}
    ): Promise<TeamCluster> {
        if (!this.isTransitionAllowed(teamCluster.props.status, update.status)) {
            logger.info(`Ignored illegal team cluster lifecycle transition teamClusterId=${teamCluster.id} teamId=${teamCluster.props.team} fromStatus=${teamCluster.props.status} toStatus=${update.status}`);

            return teamCluster;
        }

        const updatedTeamCluster = await this.teamClusterRepository.updateLifecycleById(teamCluster.id, {
            status: update.status,
            installedVersion: update.installedVersion ?? teamCluster.props.installedVersion,
            enrollmentTokenHash: update.clearEnrollmentToken ? null : teamCluster.props.enrollmentTokenHash,
            lastHeartbeatAt: update.lastHeartbeatAt === undefined
                ? teamCluster.props.lastHeartbeatAt
                : update.lastHeartbeatAt,
            lastDisconnectAt: update.lastDisconnectAt === undefined
                ? teamCluster.props.lastDisconnectAt
                : update.lastDisconnectAt,
            roleConfig: update.roleConfig ?? teamCluster.props.roleConfig
        }, options.preconditions);

        if (!updatedTeamCluster) {
            const latestTeamCluster = await this.teamClusterRepository.findById(teamCluster.id);
            if (!latestTeamCluster) {
                throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
            }

            logger.info(`Ignored stale team cluster lifecycle update teamClusterId=${teamCluster.id} teamId=${teamCluster.props.team} attemptedFromStatus=${teamCluster.props.status} attemptedToStatus=${update.status}`);

            return latestTeamCluster;
        }

        this.emitLifecycleUpdate(updatedTeamCluster);
        return updatedTeamCluster;
    }

    private isTransitionAllowed(currentStatus: TeamClusterStatus, nextStatus: TeamClusterStatus): boolean {
        if (currentStatus === nextStatus) {
            return true;
        }

        return TEAM_CLUSTER_ALLOWED_TRANSITIONS[currentStatus].has(nextStatus);
    }

    private emitLifecycleUpdate(teamCluster: TeamCluster): void {
        const payload: TeamClusterLifecycleEventPayload = {
            teamClusterId: teamCluster.id,
            teamId: teamCluster.props.team,
            deleted: false,
            teamCluster: toTeamClusterDTO(teamCluster),
            status: teamCluster.props.status,
            timestamp: new Date().toISOString()
        };

        this.socketEmitter.emitToRoom(
            getTeamClusterRoom(teamCluster.id),
            TEAM_CLUSTER_LIFECYCLE_EVENT,
            payload
        );
    }

    private emitLifecycleDeletion(teamCluster: TeamCluster): void {
        const payload: TeamClusterLifecycleEventPayload = {
            teamClusterId: teamCluster.id,
            teamId: teamCluster.props.team,
            deleted: true,
            timestamp: new Date().toISOString()
        };

        this.socketEmitter.emitToRoom(
            getTeamClusterRoom(teamCluster.id),
            TEAM_CLUSTER_LIFECYCLE_EVENT,
            payload
        );
    }

    private emitMetricsUpdate(teamCluster: TeamCluster, metrics: SystemMetrics): void {
        this.socketEmitter.emitToRoom(
            getTeamClusterRoom(teamCluster.id),
            TEAM_CLUSTER_METRICS_ALL_EVENT,
            [toTeamClusterClientMetrics(teamCluster, metrics)]
        );
    }
}
