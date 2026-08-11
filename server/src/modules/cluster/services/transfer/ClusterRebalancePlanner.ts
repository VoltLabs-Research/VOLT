
import ClusterTransferJobStore from '@modules/cluster/services/transfer/ClusterTransferJobStore';
import storagePlacementService from '@modules/cluster/services/storage/StoragePlacementService';
import systemMetricsRepository from '@modules/system/services/SystemMetricsRepository';
import type { SystemMetrics } from '@modules/system/services/SystemMetrics';
import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import { toTeamClusterLike, type TeamCluster } from '@modules/cluster/contracts/team-cluster';
import type { StoragePlacement } from '@modules/cluster/contracts/storage-placement';
import type {
    ClusterTransferJobReason
} from '@volt/contracts/modules/cluster/domain';
import {
    HARD_STORAGE_LIMIT_PCT,
    REBALANCE_TARGET_PCT,
    SOFT_STORAGE_LIMIT_PCT
} from '@shared/application/utilities/cluster-storage-policy';
import { TeamClusterStatus } from '@volt/contracts/modules/cluster/domain';
import type {
    StoragePlacementScopeType
} from '@shared/domain/contracts/team-cluster';

export interface ClusterRebalancePlan {
    teamId: string;
    scopeType: StoragePlacementScopeType;
    scopeId: string;
    destinationClusterId: string;
    reason: ClusterTransferJobReason;
}

/**
 * Automatic storage rebalancing policy: decides which placements have to leave
 * a cluster that crossed its soft storage limit, and which cluster receives
 * them. It only plans — creating the transfer jobs is the coordinator's job.
 */
export default class ClusterRebalancePlanner{
    #storagePlacementService = storagePlacementService;
    #systemMetricsRepository = systemMetricsRepository;
    #jobStore = new ClusterTransferJobStore();

    async planAutomaticRebalance(): Promise<ClusterRebalancePlan[]> {
        const teamClusterEntities = await TeamClusterEntity.findBy({ status: TeamClusterStatus.Connected });
        const storageClusters = teamClusterEntities
            .map(toTeamClusterLike)
            .filter((cluster) => cluster.effectiveCapabilities.acceptsStorageWrites);
        const metricsByCluster = new Map(await Promise.all(storageClusters.map(
            async (cluster) => [cluster.id, await this.#systemMetricsRepository.getLatestByClusterId(cluster.id)] as const
        )));
        const plans: ClusterRebalancePlan[] = [];

        for (const sourceCluster of storageClusters) {
            const diskUsagePct = metricsByCluster.get(sourceCluster.id)?.disk.usagePercent ?? 0;
            if (diskUsagePct < SOFT_STORAGE_LIMIT_PCT) {
                continue;
            }

            const destinationCluster = this.#selectRebalanceDestination(sourceCluster, storageClusters, metricsByCluster);
            if (!destinationCluster) {
                continue;
            }

            const candidatePlacement = await this.#selectVictimPlacement(sourceCluster);
            if (!candidatePlacement) {
                continue;
            }

            const existingJob = await this.#jobStore.findOpenTransferJobByScope(
                candidatePlacement.props.scopeType,
                candidatePlacement.props.scopeId
            );
            if (existingJob) {
                continue;
            }

            plans.push({
                teamId: sourceCluster.props.team,
                scopeType: candidatePlacement.props.scopeType,
                scopeId: candidatePlacement.props.scopeId,
                destinationClusterId: destinationCluster.id,
                reason: diskUsagePct >= HARD_STORAGE_LIMIT_PCT ? 'hard-limit' : 'soft-limit'
            });
        }

        return plans;
    }

    /**
     * Picks the placement whose move frees the most space, preferring the least
     * recently accessed one when two placements weigh the same.
     */
    async #selectVictimPlacement(sourceCluster: TeamCluster): Promise<StoragePlacement | null> {
        const placements = await this.#storagePlacementService.resolveTransferPlacementsForCluster(
            sourceCluster.props.team,
            sourceCluster.id
        );

        placements.sort((left, right) => {
            const rightBytes = right.props.bytesUsed ?? 0;
            const leftBytes = left.props.bytesUsed ?? 0;
            if (rightBytes !== leftBytes) {
                return rightBytes - leftBytes;
            }

            const leftAccessedAt = left.props.lastAccessedAt?.getTime() ?? 0;
            const rightAccessedAt = right.props.lastAccessedAt?.getTime() ?? 0;
            return leftAccessedAt - rightAccessedAt;
        });

        return placements[0] ?? null;
    }

    #selectRebalanceDestination(
        sourceCluster: TeamCluster,
        storageClusters: TeamCluster[],
        metricsByCluster: Map<string, SystemMetrics | null>
    ): TeamCluster | null {
        const candidates: Array<{ cluster: TeamCluster; diskUsage: number; }> = [];

        for (const candidate of storageClusters) {
            if (candidate.id === sourceCluster.id || candidate.props.team !== sourceCluster.props.team) {
                continue;
            }

            const metrics = metricsByCluster.get(candidate.id);
            const diskUsage = metrics?.disk.usagePercent ?? 0;
            if (diskUsage >= REBALANCE_TARGET_PCT) {
                continue;
            }

            candidates.push({
                cluster: candidate,
                diskUsage
            });
        }

        candidates.sort((left, right) => left.diskUsage - right.diskUsage);
        return candidates[0]?.cluster ?? null;
    }
}
