import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { ClusterRoleAwareSelectionService } from './ClusterRoleAwareSelectionService';

@Singleton(CONTAINER_TOKENS.TeamClusterSelectionService)
export class TeamClusterSelectionService {
    constructor(
        private readonly clusterRoleAwareSelectionService: ClusterRoleAwareSelectionService
    ) {}

    async resolveTeamClusterId(teamId: string, requestedTeamClusterId?: string): Promise<string> {
        return this.clusterRoleAwareSelectionService.resolveConnectedClusterId({
            teamId,
            requestedTeamClusterId
        });
    }

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
