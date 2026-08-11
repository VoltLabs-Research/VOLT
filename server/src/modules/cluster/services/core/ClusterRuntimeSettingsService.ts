import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import { toTeamClusterLike } from '@modules/cluster/contracts/team-cluster';
import { requireOwnedTeamCluster } from '@modules/cluster/services/core/cluster-access';
import teamClusterLifecycleService from '@modules/cluster/services/team-cluster/TeamClusterLifecycleService';
import { DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY } from '@modules/cluster/services/team-cluster/TeamClusterFactory';
import {
    toTeamClusterViewFromEntity,
    type TeamClusterView
} from '@modules/cluster/services/team-cluster/TeamClusterView';
import systemMetricsRepository from '@modules/system/services/SystemMetricsRepository';
import type { SystemStatus } from '@modules/system/services/SystemMetrics';
import {
    ChannelCommands,
    type TeamClusterDaemonQueueConcurrencyApplyPayload,
    type TeamClusterDaemonRoleApplyPayload,
    type TeamClusterDaemonRoleApplyResult
} from '@shared/contracts/types/team-cluster-daemon-channel';
import { TeamClusterStatus, type TeamClusterRole } from '@volt/contracts/modules/cluster/domain';
import type {
    TeamClusterQueueConcurrencyProps,
    TeamClusterQueueScopeLimitsProps
} from '@shared/contracts/types/TeamCluster';
import logger from '@shared/infrastructure/logger';

const MB_PER_GB = 1024;

interface DaemonQueueSnapshotEntry {
    name: string;
    counts: {
        waiting: number;
        active: number;
        delayed: number;
        completed: number;
        failed: number;
    };
}

interface ClusterResourceLimitsView {
    maxCpus: number | null;
    maxMemoryMB: number | null;
    status: SystemStatus | null;
    lastUpdatedAt: string | null;
}

/**
 * The runtime knobs of a connected cluster — queue concurrency, desired role and
 * the observed resource ceiling. Each write is persisted first and then pushed to
 * the daemon, so a cluster that is offline still converges on its next reconnect.
 */
class ClusterRuntimeSettingsService {
    async getRuntimeSnapshot(input: { teamId: string; teamClusterId: string }): Promise<{
        capturedAt: string;
        queueConcurrency: TeamClusterQueueConcurrencyProps;
        daemonQueues: DaemonQueueSnapshotEntry[];
        serverQueues: never[];
    }> {
        const teamCluster = await requireOwnedTeamCluster(input.teamClusterId, input.teamId);

        let daemonQueues: DaemonQueueSnapshotEntry[] = [];
        let capturedAt = new Date().toISOString();

        if (teamCluster.status === TeamClusterStatus.Connected) {
            try {
                const response = await teamClusterDaemonClient.command<{
                    queues?: DaemonQueueSnapshotEntry[];
                    capturedAt?: string;
                }>(teamCluster.id, ChannelCommands.RuntimeQueuesSnapshot, {}, { timeoutClass: 'default' });

                daemonQueues = response.queues ?? [];
                capturedAt = response.capturedAt ?? capturedAt;
            } catch (error: unknown) {
                logger.warn(error, `[ClusterRuntimeSettings.getRuntimeSnapshot] daemon snapshot failed teamClusterId=${teamCluster.id}`);
            }
        }

        return {
            capturedAt,
            queueConcurrency: teamCluster.queueConcurrency,
            daemonQueues,
            serverQueues: []
        };
    }

    async updateQueueConcurrency(input: {
        teamId: string;
        teamClusterId: string;
        queueConcurrency: TeamClusterQueueConcurrencyProps;
        queueScopeLimits: TeamClusterQueueScopeLimitsProps;
    }): Promise<{ message: string; teamCluster: TeamClusterView }> {
        const teamCluster = await requireOwnedTeamCluster(input.teamClusterId, input.teamId);
        const updated = await Object.assign(teamCluster, {
            queueConcurrency: {
                ...DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY,
                ...teamCluster.queueConcurrency,
                ...input.queueConcurrency
            },
            queueScopeLimits: input.queueScopeLimits
        }).save();

        teamClusterLifecycleService.publishTeamClusterUpdate(toTeamClusterLike(updated));

        if (updated.status === TeamClusterStatus.Connected) {
            const payload: TeamClusterDaemonQueueConcurrencyApplyPayload = {
                queueConcurrency: updated.queueConcurrency,
                queueScopeLimits: updated.queueScopeLimits
            };

            try {
                const result = await teamClusterDaemonClient.commandWithSemanticResult<{ reason?: string }>(
                    updated.id,
                    ChannelCommands.RuntimeQueueConcurrencyApply,
                    payload,
                    {
                        timeoutClass: 'long-running-control-plane',
                        retryClass: 'idempotent-command'
                    }
                );

                if (!result.accepted) {
                    logger.warn(`Persisted team cluster queue concurrency but the daemon rejected the live apply request teamClusterId=${updated.id} teamId=${input.teamId} reason=${result.reason} queueConcurrency=${payload.queueConcurrency}`);
                }
            } catch {
                logger.warn(`Persisted team cluster queue concurrency but failed to request live daemon apply teamClusterId=${updated.id} teamId=${input.teamId} queueConcurrency=${updated.queueConcurrency}`);
            }
        }

        return {
            message: 'Queue settings saved.',
            teamCluster: toTeamClusterViewFromEntity(updated)
        };
    }

    async updateRole(input: {
        teamId: string;
        userId: string;
        teamClusterId: string;
        role: TeamClusterRole;
    }): Promise<{ message: string; teamCluster: TeamClusterView }> {
        const teamCluster = await requireOwnedTeamCluster(input.teamClusterId, input.teamId);
        const currentRoleConfig = teamCluster.roleConfig;

        let updated = await Object.assign(teamCluster, {
            roleConfig: {
                ...currentRoleConfig,
                desiredRole: input.role,
                runtimeVersion: currentRoleConfig.desiredRole === input.role
                    ? currentRoleConfig.runtimeVersion
                    : currentRoleConfig.runtimeVersion + 1
            }
        }).save();

        teamClusterLifecycleService.publishTeamClusterUpdate(toTeamClusterLike(updated));

        if (updated.status === TeamClusterStatus.Connected) {
            const payload: TeamClusterDaemonRoleApplyPayload = { roleConfig: updated.roleConfig };

            try {
                const result = await teamClusterDaemonClient.commandWithSemanticResult<TeamClusterDaemonRoleApplyResult>(
                    updated.id,
                    ChannelCommands.RuntimeRoleApply,
                    payload,
                    {
                        timeoutClass: 'long-running-control-plane',
                        retryClass: 'idempotent-command'
                    }
                );

                if (result.accepted) {
                    updated = await Object.assign(updated, { roleConfig: result.data.roleConfig }).save();
                    teamClusterLifecycleService.publishTeamClusterUpdate(toTeamClusterLike(updated));
                } else {
                    logger.warn(`Persisted desired role but the daemon rejected the live apply request teamClusterId=${updated.id} teamId=${input.teamId} role=${input.role} reason=${result.reason}`);
                }
            } catch {
                logger.warn(`Persisted desired role but failed to request live daemon role apply teamClusterId=${updated.id} teamId=${input.teamId} role=${input.role}`);
            }
        }

        return {
            message: 'Team cluster role saved.',
            teamCluster: toTeamClusterViewFromEntity(updated)
        };
    }

    async getResourceLimits(input: { teamId: string; teamClusterId: string }): Promise<{
        resourceLimits: ClusterResourceLimitsView;
    }> {
        await requireOwnedTeamCluster(input.teamClusterId, input.teamId);

        const metrics = await systemMetricsRepository.getLatestByClusterId(input.teamClusterId);

        return {
            resourceLimits: metrics
                ? {
                    maxCpus: metrics.cpu.cores,
                    maxMemoryMB: Math.floor(metrics.memory.total * MB_PER_GB),
                    status: metrics.status,
                    lastUpdatedAt: metrics.timestamp.toISOString()
                }
                : {
                    maxCpus: null,
                    maxMemoryMB: null,
                    status: null,
                    lastUpdatedAt: null
                }
        };
    }
}

export default new ClusterRuntimeSettingsService();
