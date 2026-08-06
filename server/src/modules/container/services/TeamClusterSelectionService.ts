import { ErrorCodes } from '@core/constants/error-codes';
import type { ErrorCode } from '@core/constants/error-codes';
import {
    HARD_STORAGE_LIMIT_PCT,
    SOFT_STORAGE_ASSIGNMENT_PENALTY,
    SOFT_STORAGE_LIMIT_PCT
} from '@shared/application/utilities/cluster-storage-policy';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports/ITeamClusterSelectionService';
import { TeamClusterStatus } from '@shared/contracts/types';
import type { SystemMetrics } from '@modules/system/services/SystemMetrics';
import systemMetricsRepository from '@modules/system/services/SystemMetricsRepository';
import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import type { TeamCluster } from '@modules/cluster/contracts/team-cluster';
import { findTeamClusterByIdWithSensitiveData, toTeamClusterLike } from '@modules/cluster/contracts/team-cluster';

/* Placement for cross-module work: which team cluster should own a storage
 * write, a compute job, or any connected workload.
 *
 * All three are the same walk — honour an explicitly requested cluster if it can
 * do the job, otherwise score every connected candidate on its latest heartbeat
 * metrics and take the best. Only the capability filter, the error codes and the
 * co-location penalty differ, so `SelectionTarget` carries that difference. */

type SelectionCapability = 'compute' | 'storage';
type SelectionTarget = SelectionCapability | 'connected';

const NETWORK_USAGE_SATURATION_KBPS = 25_000;
const HARD_STORAGE_ASSIGNMENT_PENALTY = 100;

/** Cost of placing work away from the cluster that already owns its counterpart. */
const REMOTE_PEER_PENALTY = {
    compute: 20,
    storage: 8
} as const satisfies Record<SelectionCapability, number>;

const NO_CANDIDATE_ERRORS = {
    storage: [ErrorCodes.TEAM_CLUSTER_STORAGE_CLUSTER_REQUIRED, 'A connected storage-capable team cluster is required for this operation'],
    compute: [ErrorCodes.TEAM_CLUSTER_COMPUTE_CLUSTER_REQUIRED, 'A connected compute-capable team cluster is required for this operation'],
    connected: [ErrorCodes.TEAM_CLUSTER_CONNECTED_CLUSTER_REQUIRED, 'A connected team cluster is required for this operation']
} as const satisfies Record<SelectionTarget, readonly [ErrorCode, string]>;

const CAPABILITY_MISMATCH_ERRORS = {
    storage: [ErrorCodes.TEAM_CLUSTER_STORAGE_CAPABILITY_REQUIRED, 'The requested team cluster cannot accept storage ownership for this operation'],
    compute: [ErrorCodes.TEAM_CLUSTER_COMPUTE_CAPABILITY_REQUIRED, 'The requested team cluster cannot accept compute work for this operation']
} as const satisfies Record<SelectionCapability, readonly [ErrorCode, string]>;

const buildSelectionError = ([code, message]: readonly [ErrorCode, string]): ApplicationError => ApplicationError.conflict(code, message);

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

/** Absent heartbeat metrics score as an average cluster rather than a dead one. */
const normalizePercent = (value: number | undefined): number => clampPercent(value ?? 50);

const normalizeNetworkUsage = (metrics: SystemMetrics | null): number => metrics
    ? clampPercent((metrics.network.total / NETWORK_USAGE_SATURATION_KBPS) * 100)
    : 50;

const acceptsCapability = (cluster: TeamCluster, capability: SelectionCapability): boolean => capability === 'storage'
    ? cluster.effectiveCapabilities.acceptsStorageWrites
    : cluster.effectiveCapabilities.acceptsComputeJobs;

const scoreCluster = (
    target: SelectionTarget,
    cluster: TeamCluster,
    metrics: SystemMetrics | null,
    preferredPeerClusterId?: string
): number => {
    const diskUsage = normalizePercent(metrics?.disk.usagePercent);

    let score = 100
        - (normalizePercent(metrics?.cpu.usage) * 0.45)
        - (normalizePercent(metrics?.memory.usagePercent) * 0.30)
        - (diskUsage * 0.15)
        - (normalizeNetworkUsage(metrics) * 0.10);

    if (target !== 'connected' && preferredPeerClusterId && preferredPeerClusterId !== cluster._id) {
        score -= REMOTE_PEER_PENALTY[target];
    }

    if (target === 'storage' && diskUsage >= SOFT_STORAGE_LIMIT_PCT) {
        score -= SOFT_STORAGE_ASSIGNMENT_PENALTY;
    }

    if (target === 'storage' && diskUsage >= HARD_STORAGE_LIMIT_PCT) {
        score -= HARD_STORAGE_ASSIGNMENT_PENALTY;
    }

    return score;
};

class TeamClusterSelectionService implements ITeamClusterSelectionService {
    async resolveConnectedClusterId(teamId: string, requestedTeamClusterId?: string): Promise<string> {
        return this.#resolveClusterId('connected', teamId, requestedTeamClusterId);
    }

    async resolveComputeClusterId(teamId: string, requestedTeamClusterId?: string, preferredStorageClusterId?: string): Promise<string> {
        return this.#resolveClusterId('compute', teamId, requestedTeamClusterId, preferredStorageClusterId);
    }

    async resolveStorageClusterId(teamId: string, requestedTeamClusterId?: string, preferredComputeClusterId?: string): Promise<string> {
        return this.#resolveClusterId('storage', teamId, requestedTeamClusterId, preferredComputeClusterId);
    }

    async #resolveClusterId(
        target: SelectionTarget,
        teamId: string,
        requestedTeamClusterId?: string,
        preferredPeerClusterId?: string
    ): Promise<string> {
        const requestedCluster = requestedTeamClusterId
            ? await this.#requireTeamOwnedCluster(teamId, requestedTeamClusterId)
            : null;

        if (requestedCluster) {
            if (requestedCluster.props.status !== TeamClusterStatus.Connected) {
                throw buildSelectionError(NO_CANDIDATE_ERRORS[target]);
            }

            if (target !== 'connected' && !acceptsCapability(requestedCluster, target)) {
                throw buildSelectionError(CAPABILITY_MISMATCH_ERRORS[target]);
            }

            return requestedCluster._id;
        }

        const connectedClusters = await this.#listConnectedClusters(teamId);
        const candidates = target === 'connected'
            ? connectedClusters
            : connectedClusters.filter((cluster) => acceptsCapability(cluster, target));
        if (!candidates.length) {
            throw buildSelectionError(NO_CANDIDATE_ERRORS[target]);
        }

        return this.#pickBestClusterId(target, candidates, preferredPeerClusterId);
    }

    async #requireTeamOwnedCluster(teamId: string, requestedTeamClusterId: string): Promise<TeamCluster> {
        const requestedCluster = await findTeamClusterByIdWithSensitiveData(requestedTeamClusterId);
        if (!requestedCluster || requestedCluster.props.team !== teamId) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_CLUSTER_NOT_FOUND,
                'Team cluster not found for the requested team'
            );
        }

        return requestedCluster;
    }

    async #listConnectedClusters(teamId: string): Promise<TeamCluster[]> {
        const entities = await TeamClusterEntity.find({
            where: {
                team: teamId,
                status: TeamClusterStatus.Connected
            },
            order: { createdAt: 'ASC' }
        });

        return entities.map(toTeamClusterLike);
    }

    /** Highest score wins; candidates is non-empty, so there is always a winner. */
    async #pickBestClusterId(target: SelectionTarget, candidates: TeamCluster[], preferredPeerClusterId?: string): Promise<string> {
        const scoredCandidates = await Promise.all(candidates.map(async (cluster) => {
            const metrics = await systemMetricsRepository.getLatestByClusterId(cluster._id);
            return {
                cluster,
                metrics,
                score: scoreCluster(target, cluster, metrics, preferredPeerClusterId)
            };
        }));

        scoredCandidates.sort((left, right) => {
            if (right.score !== left.score) {
                return right.score - left.score;
            }

            const metricsRank = Number(Boolean(right.metrics)) - Number(Boolean(left.metrics));
            if (metricsRank !== 0) {
                return metricsRank;
            }

            return left.cluster.props.createdAt.getTime() - right.cluster.props.createdAt.getTime();
        });

        return scoredCandidates[0].cluster._id;
    }
}

export default new TeamClusterSelectionService();
