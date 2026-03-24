import { inject, injectable } from 'tsyringe';
import { ClusterRoleAwareSelectionService } from './ClusterRoleAwareSelectionService';

@injectable()
export class TeamClusterSelectionService {
    constructor(
        @inject(ClusterRoleAwareSelectionService)
        private readonly clusterRoleAwareSelectionService: ClusterRoleAwareSelectionService
    ) {}

    async resolveTeamClusterId(teamId: string, requestedTeamClusterId?: string): Promise<string> {
        return this.clusterRoleAwareSelectionService.resolveComputeClusterId({
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
