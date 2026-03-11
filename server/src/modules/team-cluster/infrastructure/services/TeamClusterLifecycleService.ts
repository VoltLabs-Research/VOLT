import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { toTeamClusterDTO, TeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
import TeamCluster, { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import FirstTeamClusterConnectedEvent from '@modules/team-cluster/domain/events/FirstTeamClusterConnectedEvent';
import { getTeamClusterRoom, TEAM_CLUSTER_LIFECYCLE_EVENT } from '@modules/team-cluster/utilities/teamClusterSocket';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import DaemonCredentialGuard from '@shared/application/team-cluster/DaemonCredentialGuard';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { ISystemMetricsRepository } from '@modules/system/domain/port/ISystemMetricsRepository';
import type { SystemMetrics } from '@modules/system/domain/value-objects/SystemMetrics';

const BYTES_PER_GB = 1024 ** 3;

interface DaemonMetricsSnapshot {
    timestamp: string;
    hostname: string;
    uptimeSeconds: number;
    cpuUsagePercent: number;
    cpuLoadAverage: number[];
    cpuPerCoreUsagePercent: number[];
    memory: {
        totalBytes: number;
        freeBytes: number;
        usedBytes: number;
        usagePercent: number;
    };
    disk: {
        totalBytes: number;
        freeBytes: number;
        usedBytes: number;
        usagePercent: number;
    };
    diskOperations: {
        readMegabytesPerSecond: number;
        writeMegabytesPerSecond: number;
        readIOPS: number;
        writeIOPS: number;
        totalIOPS: number;
    };
    network: {
        incomingKilobytesPerSecond: number;
        outgoingKilobytesPerSecond: number;
        totalKilobytesPerSecond: number;
        receivedBytes: number;
        sentBytes: number;
    };
    cloudLatencyMs: number | null;
    connectedToCloud: boolean;
};

interface TeamClusterLifecycleUpdate {
    status: TeamClusterStatus;
    installedVersion?: string;
    lastHeartbeatAt?: Date | null;
    lastDisconnectAt?: Date | null;
    clearEnrollmentToken?: boolean;
};

interface TeamClusterLifecycleEventPayload {
    teamClusterId: string;
    teamId: string;
    deleted: boolean;
    teamCluster?: TeamClusterDTO;
    status?: TeamClusterStatus;
    timestamp: string;
};

@injectable()
export default class TeamClusterLifecycleService {
    constructor(
        @inject(SHARED_TOKENS.DaemonCredentialGuard)
        private readonly daemonCredentialGuard: DaemonCredentialGuard,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,

        @inject(SOCKET_TOKENS.SocketEmitter)
        private readonly socketEmitter: ISocketEmitter,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus,

        @inject(SYSTEM_TOKENS.SystemMetricsRepository)
        private readonly systemMetricsRepository: ISystemMetricsRepository
    ){}

    async processHealthcheck(teamClusterId: string, enrollmentToken: string, installedVersion?: string): Promise<{
        teamCluster: TeamClusterDTO;
        daemonPassword: string;
    }> {
        const teamCluster = await this.daemonCredentialGuard.requireByEnrollment(teamClusterId, enrollmentToken);
        const daemonPassword = this.daemonCredentialGuard.getDecryptedDaemonPassword(teamCluster);
        const updatedTeamCluster = await this.persistLifecycleUpdate(teamCluster, {
            status: TeamClusterStatus.HealthcheckReceived,
            installedVersion,
            clearEnrollmentToken: true
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
        });

        return toTeamClusterDTO(updatedTeamCluster);
    }

    async recordHeartbeat(
        teamClusterId: string,
        daemonPassword: string,
        installedVersion?: string,
        metrics?: DaemonMetricsSnapshot
    ): Promise<TeamClusterDTO> {
        const teamCluster = await this.daemonCredentialGuard.requireByDaemonPassword(teamClusterId, daemonPassword);
        const nextStatus = teamCluster.props.status === TeamClusterStatus.Deleting
            || teamCluster.props.status === TeamClusterStatus.DeleteFailed
            || teamCluster.props.status === TeamClusterStatus.Updating
            || teamCluster.props.status === TeamClusterStatus.UpdateFailed
            ? teamCluster.props.status
            : TeamClusterStatus.Connected;
        const isFirstTeamConnection = teamCluster.props.lastHeartbeatAt === null
            && !(await this.teamClusterRepository.hasTeamEverConnected(teamCluster.props.team));
        const updatedTeamCluster = await this.persistLifecycleUpdate(teamCluster, {
            status: nextStatus,
            installedVersion,
            lastHeartbeatAt: new Date()
        });

        if (isFirstTeamConnection) {
            await this.eventBus.publish(new FirstTeamClusterConnectedEvent({
                teamId: updatedTeamCluster.props.team,
                teamClusterId: updatedTeamCluster.id
            }));
        }

        if (metrics) {
            await this.systemMetricsRepository.save(this.toSystemMetrics(updatedTeamCluster.id, metrics));
        }

        return toTeamClusterDTO(updatedTeamCluster);
    }

    private toSystemMetrics(teamClusterId: string, metrics: DaemonMetricsSnapshot): SystemMetrics {
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
        });

        return toTeamClusterDTO(updatedTeamCluster);
    }

    async markUpdating(teamClusterId: string): Promise<TeamClusterDTO> {
        const teamCluster = await this.requireTeamClusterById(teamClusterId);
        const updatedTeamCluster = await this.persistLifecycleUpdate(teamCluster, {
            status: TeamClusterStatus.Updating
        });

        return toTeamClusterDTO(updatedTeamCluster);
    }

    async markUpdatingTimeouts(cutoff: Date): Promise<number> {
        const timedOutClusters = await this.teamClusterRepository.findUpdatingTimedOutClusters(cutoff);

        for (const teamCluster of timedOutClusters) {
            await this.persistLifecycleUpdate(teamCluster, {
                status: TeamClusterStatus.UpdateFailed
            });

            logger.warn({
                action: 'team-cluster.update-timeout',
                teamClusterId: teamCluster.id,
                teamId: teamCluster.props.team
            }, 'Team cluster marked as update-failed after update timeout');
        }

        return timedOutClusters.length;
    }

    async completeDeletion(teamClusterId: string, daemonPassword: string): Promise<void> {
        const teamCluster = await this.daemonCredentialGuard.requireByDaemonPassword(teamClusterId, daemonPassword);
        await this.deleteTeamCluster(teamCluster);
    }

    async markHeartbeatTimeouts(cutoff: Date): Promise<number> {
        const timedOutClusters = await this.teamClusterRepository.findHeartbeatTimedOutConnectedClusters(cutoff);

        for (const teamCluster of timedOutClusters) {
            await this.persistLifecycleUpdate(teamCluster, {
                status: TeamClusterStatus.Disconnected,
                lastDisconnectAt: new Date()
            });

            logger.warn({
                action: 'team-cluster.heartbeat-timeout',
                teamClusterId: teamCluster.id,
                teamId: teamCluster.props.team,
                lastHeartbeatAt: teamCluster.props.lastHeartbeatAt
            }, 'Team cluster marked as disconnected after heartbeat timeout');
        }

        return timedOutClusters.length;
    }

    async finalizeDeletingClustersByEvidence(cutoff: Date): Promise<number> {
        const deletingClusters = await this.teamClusterRepository.findHeartbeatTimedOutDeletingClusters(cutoff);

        for (const teamCluster of deletingClusters) {
            await this.deleteTeamCluster(teamCluster);

            logger.info({
                action: 'team-cluster.delete.completed-from-heartbeat-timeout',
                teamClusterId: teamCluster.id,
                teamId: teamCluster.props.team,
                lastHeartbeatAt: teamCluster.props.lastHeartbeatAt
            }, 'Team cluster deletion completed after runtime disconnect evidence');
        }

        return deletingClusters.length;
    }

    async deleteTeamCluster(teamCluster: TeamCluster): Promise<void> {
        const deleted = await this.teamClusterRepository.deleteById(teamCluster.id);
        if (!deleted) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }

        this.emitLifecycleDeletion(teamCluster);
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
        update: TeamClusterLifecycleUpdate
    ): Promise<TeamCluster> {
        const updatedTeamCluster = await this.teamClusterRepository.updateById(teamCluster.id, {
            status: update.status,
            installedVersion: update.installedVersion ?? teamCluster.props.installedVersion,
            enrollmentTokenHash: update.clearEnrollmentToken ? null : teamCluster.props.enrollmentTokenHash,
            lastHeartbeatAt: update.lastHeartbeatAt === undefined
                ? teamCluster.props.lastHeartbeatAt
                : update.lastHeartbeatAt,
            lastDisconnectAt: update.lastDisconnectAt === undefined
                ? teamCluster.props.lastDisconnectAt
                : update.lastDisconnectAt
        });

        if (!updatedTeamCluster) {
            throw ApplicationError.notFound('TeamCluster::NotFound', 'Team cluster not found');
        }

        this.emitLifecycleUpdate(updatedTeamCluster);
        return updatedTeamCluster;
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
};
