/**
 * Neutral, cross-module repository port for the TeamCluster aggregate.
 *
 * Extracted from `@modules/cluster/ports/ITeamClusterRepository` during
 * the detachable-modules migration. The concrete repository stays in the
 * cluster module, registered under `CLUSTER_SERVICE_TOKENS.TeamClusterRepository`
 * (same `Symbol.for` key as the cluster module's
 * `CLUSTER_TOKENS.TeamClusterRepository`, so resolution is byte-identical).
 * Consumers `@inject(...)` against this port without importing `@modules/cluster`.
 * The original port file re-exports this so existing importers compile unchanged.
 *
 * PHASE-2 FOLLOW-UP (type-only recoupling): the entity `TeamCluster` is a class
 * (with `props` + an `id` getter), so it cannot be moved into this pure-type
 * contracts layer without dragging runtime in. It is imported here with
 * `import type` only (erased by tsc — no runtime/decorator coupling). The data
 * shapes `TeamClusterProps` / `TeamClusterStatus` already live neutrally in
 * `@shared/contracts/types/TeamCluster`. Replacing the class with a structural
 * entity contract is deferred.
 */
import type TeamCluster from '@modules/cluster/entities/TeamCluster';
import type { TeamClusterProps, TeamClusterStatus } from '@shared/contracts/types/TeamCluster';
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface TeamClusterLifecycleUpdatePreconditions {
    allowedCurrentStatuses?: TeamClusterStatus[];
    requireUpdatedBefore?: Date;
}

export interface ITeamClusterRepository extends IBaseRepository<TeamCluster, TeamClusterProps> {
    findByIdWithSensitiveData(teamClusterId: string): Promise<TeamCluster | null>;
    findDeletingClustersDisconnectedBefore(cutoff: Date): Promise<TeamCluster[]>;
    findDeletingTimedOutClusters(cutoff: Date): Promise<TeamCluster[]>;
    findActiveDemoByTeamId(teamId: string): Promise<TeamCluster | null>;
    findActiveDemoByTeamIdWithSensitiveData(teamId: string): Promise<TeamCluster | null>;
    findExpiredDemos(now: Date): Promise<TeamCluster[]>;
    hasTeamEverConnected(teamId: string): Promise<boolean>;
    updateLifecycleById(
        teamClusterId: string,
        data: Partial<TeamClusterProps>,
        preconditions?: TeamClusterLifecycleUpdatePreconditions
    ): Promise<TeamCluster | null>;
}
