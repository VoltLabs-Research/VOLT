import TeamCluster, { TeamClusterProps, TeamClusterStatus } from '@modules/cluster/domain/entities/TeamCluster';
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface TeamClusterLifecycleUpdatePreconditions {
    allowedCurrentStatuses?: TeamClusterStatus[];
    requireHeartbeatBefore?: Date;
    requireUpdatedBefore?: Date;
}

export interface ITeamClusterRepository extends IBaseRepository<TeamCluster, TeamClusterProps> {
    findByIdWithSensitiveData(teamClusterId: string): Promise<TeamCluster | null>;
    findHeartbeatTimedOutConnectedClusters(cutoff: Date): Promise<TeamCluster[]>;
    findHeartbeatTimedOutDeletingClusters(cutoff: Date): Promise<TeamCluster[]>;
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
