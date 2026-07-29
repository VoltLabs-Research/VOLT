import type { ITeamClusterSelectionService } from '@shared/contracts/ports/ITeamClusterSelectionService';
import clusterRoleAwareSelectionService from './ClusterRoleAwareSelectionService';

class TeamClusterSelectionService implements ITeamClusterSelectionService {
    private readonly clusterRoleAwareSelectionService = clusterRoleAwareSelectionService;

    async resolveConnectedClusterId(teamId: string, requestedTeamClusterId?: string): Promise<string> {
        return this.clusterRoleAwareSelectionService.resolveConnectedClusterId({
            teamId,
            requestedTeamClusterId
        });
    }

    async resolveComputeClusterId(
        teamId: string,
        requestedTeamClusterId?: string,
        preferredStorageClusterId?: string
    ): Promise<string> {
        return this.clusterRoleAwareSelectionService.resolveComputeClusterId({
            teamId,
            requestedTeamClusterId,
            preferredStorageClusterId
        });
    }

    async resolveStorageClusterId(
        teamId: string,
        requestedTeamClusterId?: string,
        preferredComputeClusterId?: string
    ): Promise<string> {
        return this.clusterRoleAwareSelectionService.resolveStorageClusterId({
            teamId,
            requestedTeamClusterId,
            preferredComputeClusterId
        });
    }
}

export default new TeamClusterSelectionService();
