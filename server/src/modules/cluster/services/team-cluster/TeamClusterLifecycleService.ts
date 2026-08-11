import { ErrorCodes } from '@core/constants/error-codes';
import systemMetricsRepository from '@modules/system/services/SystemMetricsRepository';
import type { TeamClusterHeartbeatMetricsInput } from '@modules/cluster/socket/TeamClusterSocketProtocol';
import { toTeamClusterView, type TeamClusterView } from '@modules/cluster/services/team-cluster/TeamClusterView';
import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import { toTeamClusterLike, type TeamCluster } from '@modules/cluster/contracts/team-cluster';
import {
    TeamClusterStatus,
    type TeamClusterHostCapabilitiesProps,
    type TeamClusterRuntimeRoleConfigProps
} from '@shared/contracts/types/TeamCluster';
import {
    HEARTBEAT_LOCKED_STATUSES,
    isTeamClusterTransitionAllowed
} from '@modules/cluster/services/team-cluster/team-cluster-status-transitions';
import { toSystemMetricsFromHeartbeat } from '@modules/cluster/services/team-cluster/team-cluster-heartbeat-metrics';
import {
    emitTeamClusterLifecycleDeletion,
    emitTeamClusterLifecycleUpdate,
    emitTeamClusterMetricsUpdate
} from '@modules/cluster/services/team-cluster/TeamClusterLifecycleEvents';
import ApplicationError from '@shared/application/errors/ApplicationError';
import DaemonCredentialGuard from '@modules/cluster/services/daemon/DaemonCredentialGuard';
import logger from '@shared/infrastructure/logger';
import { In, LessThan } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';

interface TeamClusterLifecycleUpdatePreconditions {
    allowedCurrentStatuses?: TeamClusterStatus[];
    requireUpdatedBefore?: Date;
}

interface TeamClusterLifecycleUpdate {
    status: TeamClusterStatus;
    installedVersion?: string;
    lastHeartbeatAt?: Date | null;
    lastDisconnectAt?: Date | null;
    clearEnrollmentToken?: boolean;
    roleConfig?: TeamClusterRuntimeRoleConfigProps;
    hostCapabilities?: TeamClusterHostCapabilitiesProps;
}

/**
 * One heartbeat, as the control plane receives it.
 *
 * A record rather than a positional list because every field after the identity
 * pair is optional and independent, and the daemon that sends them may be older
 * than the control plane that reads them.
 */
export interface RecordHeartbeatInput {
    teamClusterId: string;
    daemonPassword: string;
    installedVersion?: string;
    roleConfig?: TeamClusterRuntimeRoleConfigProps;
    metrics?: TeamClusterHeartbeatMetricsInput;
    hostCapabilities?: TeamClusterHostCapabilitiesProps;
}

interface PersistLifecycleUpdateOutcome {
    applied: boolean;
    teamCluster: TeamCluster;
}

const countFinalizedTeamClusters = async (
    teamClusters: TeamCluster[],
    finalize: (teamCluster: TeamCluster) => Promise<boolean>
): Promise<number> => {
    const outcomes = await Promise.all(teamClusters.map(finalize));
    return outcomes.filter(Boolean).length;
};

class TeamClusterLifecycleService {
    private readonly daemonCredentialGuard = new DaemonCredentialGuard();

    async processHealthcheck(teamClusterId: string, enrollmentToken: string, installedVersion?: string): Promise<{
        teamCluster: TeamClusterView;
        daemonPassword: string;
    }> {
        const teamCluster = await this.daemonCredentialGuard.requireByEnrollment(teamClusterId, enrollmentToken);
        const daemonPassword = await this.daemonCredentialGuard.getDecryptedDaemonPassword(teamCluster);
        const updatedTeamCluster = await this.persistLifecycleUpdate(teamCluster, {
            status: TeamClusterStatus.HealthcheckReceived,
            installedVersion,
            clearEnrollmentToken: true
        }, {
            allowedCurrentStatuses: [teamCluster.props.status]
        });

        return {
            teamCluster: toTeamClusterView(updatedTeamCluster),
            daemonPassword
        };
    }

    async updateLifecycleStatus(
        teamClusterId: string,
        daemonPassword: string,
        status: TeamClusterStatus,
        installedVersion?: string
    ): Promise<TeamClusterView> {
        const teamCluster = await this.daemonCredentialGuard.requireByDaemonPassword(teamClusterId, daemonPassword);

        const updatedTeamCluster = await this.persistLifecycleUpdate(teamCluster, {
            status,
            installedVersion,
            lastDisconnectAt: status === TeamClusterStatus.Disconnected ? new Date() : undefined
        }, {
            allowedCurrentStatuses: [teamCluster.props.status]
        });

        return toTeamClusterView(updatedTeamCluster);
    }

    async recordHeartbeat(input: RecordHeartbeatInput): Promise<TeamClusterView> {
        const teamCluster = await this.daemonCredentialGuard.requireByDaemonPassword(input.teamClusterId, input.daemonPassword);
        const updatedTeamCluster = await this.persistLifecycleUpdate(teamCluster, {
            status: teamCluster.props.status,
            installedVersion: input.installedVersion,
            lastHeartbeatAt: new Date(),
            roleConfig: input.roleConfig,
            hostCapabilities: input.hostCapabilities
        }, {
            allowedCurrentStatuses: [teamCluster.props.status]
        });

        if (input.metrics) {
            const systemMetrics = toSystemMetricsFromHeartbeat(updatedTeamCluster.id, input.metrics);

            void systemMetricsRepository.save(systemMetrics).catch(() => {
                logger.warn(`Failed to persist system metrics snapshot after heartbeat acknowledgement teamClusterId=${updatedTeamCluster.id}`);
            });

            emitTeamClusterMetricsUpdate(updatedTeamCluster, systemMetrics);
        }

        return toTeamClusterView(updatedTeamCluster);
    }

    async markDaemonConnected(teamClusterId: string): Promise<TeamClusterView> {
        const teamCluster = await this.requireTeamClusterById(teamClusterId);
        const nextStatus = HEARTBEAT_LOCKED_STATUSES.has(teamCluster.props.status)
            ? teamCluster.props.status
            : TeamClusterStatus.Connected;
        const updatedTeamCluster = await this.persistLifecycleUpdate(teamCluster, {
            status: nextStatus,
            lastHeartbeatAt: new Date(),
            lastDisconnectAt: null
        }, {
            allowedCurrentStatuses: [teamCluster.props.status]
        });

        return toTeamClusterView(updatedTeamCluster);
    }

    async markDaemonDisconnected(teamClusterId: string): Promise<TeamClusterView> {
        const teamCluster = await this.requireTeamClusterById(teamClusterId);
        const nextStatus = teamCluster.props.status === TeamClusterStatus.Connected
            ? TeamClusterStatus.Disconnected
            : teamCluster.props.status;
        const updatedTeamCluster = await this.persistLifecycleUpdate(teamCluster, {
            status: nextStatus,
            lastDisconnectAt: new Date()
        }, {
            allowedCurrentStatuses: [teamCluster.props.status]
        });

        return toTeamClusterView(updatedTeamCluster);
    }

    async authenticateDaemonConnection(teamClusterId: string, daemonPassword: string): Promise<void> {
        await this.daemonCredentialGuard.requireByDaemonPassword(teamClusterId, daemonPassword);
    }

    async markDeleting(teamClusterId: string): Promise<TeamClusterView> {
        const teamCluster = await this.requireTeamClusterById(teamClusterId);
        const updatedTeamCluster = await this.persistLifecycleUpdate(teamCluster, {
            status: TeamClusterStatus.Deleting
        }, {
            allowedCurrentStatuses: [teamCluster.props.status]
        });

        return toTeamClusterView(updatedTeamCluster);
    }

    async completeDeletion(teamClusterId: string, daemonPassword: string): Promise<void> {
        const teamCluster = await this.daemonCredentialGuard.requireByDaemonPassword(teamClusterId, daemonPassword);
        await this.deleteTeamCluster(teamCluster);
    }

    async finalizeDeletingClustersByEvidence(cutoff: Date): Promise<number> {
        const deletingClusterEntities = await TeamClusterEntity.findBy({
            status: TeamClusterStatus.Deleting,
            lastDisconnectAt: LessThan(cutoff)
        });
        const deletingClusters = deletingClusterEntities.map(toTeamClusterLike);

        return countFinalizedTeamClusters(deletingClusters, async (teamCluster) => {
            const currentTeamCluster = await this.requireTeamClusterById(teamCluster.id);
            if (currentTeamCluster.props.status !== TeamClusterStatus.Deleting) return false;
            if (currentTeamCluster.props.lastDisconnectAt === null || currentTeamCluster.props.lastDisconnectAt >= cutoff) return false;

            await this.deleteTeamCluster(currentTeamCluster);
            logger.info(`Team cluster deletion completed after runtime disconnect evidence teamClusterId=${teamCluster.id} teamId=${teamCluster.props.team} lastDisconnectAt=${teamCluster.props.lastDisconnectAt}`);
            return true;
        });
    }

    async markDeletingTimeouts(cutoff: Date): Promise<number> {
        const timedOutClusterEntities = await TeamClusterEntity.findBy({
            status: TeamClusterStatus.Deleting,
            updatedAt: LessThan(cutoff)
        });
        const timedOutClusters = timedOutClusterEntities.map(toTeamClusterLike);

        return countFinalizedTeamClusters(timedOutClusters, async (teamCluster) => {
            const updateOutcome = await this.persistLifecycleUpdateOutcome(teamCluster, {
                status: TeamClusterStatus.DeleteFailed
            }, {
                allowedCurrentStatuses: [TeamClusterStatus.Deleting],
                requireUpdatedBefore: cutoff
            });

            if (!updateOutcome.applied) return false;
            if (updateOutcome.teamCluster.props.status !== TeamClusterStatus.DeleteFailed) return false;

            logger.warn(`Team cluster marked as delete-failed after delete timeout teamClusterId=${teamCluster.id} teamId=${teamCluster.props.team}`);
            return true;
        });
    }

    async deleteTeamCluster(teamCluster: TeamCluster): Promise<void> {
        const deleted = await TeamClusterEntity.delete({ id: teamCluster.id });
        if (!deleted.affected) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_CLUSTER_NOT_FOUND, 'Team cluster not found');
        }

        emitTeamClusterLifecycleDeletion(teamCluster);
    }

    publishTeamClusterUpdate(teamCluster: TeamCluster): void {
        emitTeamClusterLifecycleUpdate(teamCluster);
    }

    private async requireTeamClusterById(teamClusterId: string): Promise<TeamCluster> {
        const entity = await TeamClusterEntity.findOneBy({ id: teamClusterId });
        if (!entity) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_CLUSTER_NOT_FOUND, 'Team cluster not found');
        }

        return toTeamClusterLike(entity);
    }

    private async persistLifecycleUpdate(
        teamCluster: TeamCluster,
        update: TeamClusterLifecycleUpdate,
        preconditions: TeamClusterLifecycleUpdatePreconditions = {}
    ): Promise<TeamCluster> {
        return (await this.persistLifecycleUpdateOutcome(teamCluster, update, preconditions)).teamCluster;
    }

    private async persistLifecycleUpdateOutcome(
        teamCluster: TeamCluster,
        update: TeamClusterLifecycleUpdate,
        preconditions: TeamClusterLifecycleUpdatePreconditions = {}
    ): Promise<PersistLifecycleUpdateOutcome> {
        if (!isTeamClusterTransitionAllowed(teamCluster.props.status, update.status)) {
            logger.info(`Ignored illegal team cluster lifecycle transition teamClusterId=${teamCluster.id} teamId=${teamCluster.props.team} fromStatus=${teamCluster.props.status} toStatus=${update.status}`);

            return {
                applied: false,
                teamCluster
            };
        }

        const where: FindOptionsWhere<TeamClusterEntity> = { id: teamCluster.id };

        if (preconditions.allowedCurrentStatuses?.length) {
            where.status = In(preconditions.allowedCurrentStatuses);
        }

        if (preconditions.requireUpdatedBefore) {
            where.updatedAt = LessThan(preconditions.requireUpdatedBefore);
        }

        const updateResult = await TeamClusterEntity.update(where, {
            status: update.status,
            installedVersion: update.installedVersion ?? teamCluster.props.installedVersion,
            enrollmentTokenHash: update.clearEnrollmentToken ? null : teamCluster.props.enrollmentTokenHash,
            lastHeartbeatAt: update.lastHeartbeatAt === undefined
                ? teamCluster.props.lastHeartbeatAt
                : update.lastHeartbeatAt,
            lastDisconnectAt: update.lastDisconnectAt === undefined
                ? teamCluster.props.lastDisconnectAt
                : update.lastDisconnectAt,
            roleConfig: update.roleConfig ?? teamCluster.props.roleConfig,
            hostCapabilities: update.hostCapabilities ?? teamCluster.props.hostCapabilities
        });

        if (!updateResult.affected) {
            const latestTeamCluster = await this.requireTeamClusterById(teamCluster.id);

            logger.info(`Ignored stale team cluster lifecycle update teamClusterId=${teamCluster.id} teamId=${teamCluster.props.team} attemptedFromStatus=${teamCluster.props.status} attemptedToStatus=${update.status}`);

            return {
                applied: false,
                teamCluster: latestTeamCluster
            };
        }

        const updatedTeamCluster = await this.requireTeamClusterById(teamCluster.id);

        emitTeamClusterLifecycleUpdate(updatedTeamCluster);
        return {
            applied: true,
            teamCluster: updatedTeamCluster
        };
    }
}

export default new TeamClusterLifecycleService();
