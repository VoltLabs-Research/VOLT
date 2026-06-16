import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import type { ITeamClusterRepository } from '@shared/contracts/ports';
import type { IContainerDeploymentProgressService } from '@shared/contracts/ports';
import { CLUSTER_SERVICE_TOKENS } from '@shared/contracts/tokens/ClusterServiceTokens';
import { CONTAINER_CONTRACT_TOKENS } from '@shared/contracts/tokens/ContainerTokens';
import { AliasOf, Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

export interface ContainerDeploymentProgressPayload {
    operationId: string;
    teamClusterId: string;
    teamId: string;
    stage: string;
    step?: string;
    image?: string;
    containerName?: string;
    containerId?: string;
    timestamp: string;
}

@Singleton()
@AliasOf(CONTAINER_CONTRACT_TOKENS.ContainerDeploymentProgressService)
export class ContainerDeploymentProgressService implements IContainerDeploymentProgressService {
    constructor(
        private readonly socketEmitter: SocketIOEmitter,
        @inject(CLUSTER_SERVICE_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository
    ) {}

    async emitToTeam(input: Omit<ContainerDeploymentProgressPayload, 'teamId'>): Promise<void> {
        const teamCluster = await this.teamClusterRepository.findById(input.teamClusterId);
        if (!teamCluster) {
            return;
        }

        this.socketEmitter.emitToRoom(`team:${teamCluster.props.team}`, 'container.deploy.progress', {
            ...input,
            teamId: teamCluster.props.team
        } satisfies ContainerDeploymentProgressPayload);
    }
}
