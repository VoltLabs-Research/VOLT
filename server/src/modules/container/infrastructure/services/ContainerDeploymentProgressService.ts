import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { inject, injectable } from 'tsyringe';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';

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
};

@injectable()
export class ContainerDeploymentProgressService {
    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter)
        private readonly socketEmitter: ISocketEmitter,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository
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
