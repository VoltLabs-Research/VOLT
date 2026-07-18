import type SocketIOEmitter from '@modules/socket/services/SocketIOEmitter';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import TeamClusterRepository from '@modules/cluster/repositories/TeamClusterRepository';

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

export class ContainerDeploymentProgressService {
    private readonly teamClusterRepository = new TeamClusterRepository();

    constructor(
        private readonly socketEmitter: SocketIOEmitter
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

export default new ContainerDeploymentProgressService(socketIOEmitter);
