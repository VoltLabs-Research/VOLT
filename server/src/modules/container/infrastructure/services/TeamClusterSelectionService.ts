import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports/ITeamClusterSelectionService';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { ClusterRoleAwareSelectionService } from './ClusterRoleAwareSelectionService';

@Singleton(CONTAINER_TOKENS.TeamClusterSelectionService)
export class TeamClusterSelectionService implements ITeamClusterSelectionService {
    constructor(
        private readonly clusterRoleAwareSelectionService: ClusterRoleAwareSelectionService
    ) {}

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
