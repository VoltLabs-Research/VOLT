import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import TeamClusterRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import { injectable } from 'tsyringe';

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
        
        private readonly socketEmitter: SocketIOEmitter,

        
        private readonly teamClusterRepository: TeamClusterRepository
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
