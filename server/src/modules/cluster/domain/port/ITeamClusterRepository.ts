import TeamCluster, { TeamClusterProps, TeamClusterStatus } from '@modules/cluster/domain/entities/TeamCluster';
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
