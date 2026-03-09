import TeamCluster, { TeamClusterProps } from '@modules/team-cluster/domain/entities/TeamCluster';
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface ITeamClusterRepository extends IBaseRepository<TeamCluster, TeamClusterProps> {
    findByIdWithSensitiveData(teamClusterId: string): Promise<TeamCluster | null>;
    findHeartbeatTimedOutConnectedClusters(cutoff: Date): Promise<TeamCluster[]>;
    findHeartbeatTimedOutDeletingClusters(cutoff: Date): Promise<TeamCluster[]>;
    hasTeamEverConnected(teamId: string): Promise<boolean>;
};
