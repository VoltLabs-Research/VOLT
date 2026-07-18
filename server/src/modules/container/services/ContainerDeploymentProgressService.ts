import type SocketIOEmitter from '@modules/socket/services/SocketIOEmitter';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import TeamClusterModel from '@modules/cluster/models/TeamClusterModel';

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
    constructor(
        private readonly socketEmitter: SocketIOEmitter
    ) {}

    async emitToTeam(input: Omit<ContainerDeploymentProgressPayload, 'teamId'>): Promise<void> {
        const teamCluster = await TeamClusterModel.findById(input.teamClusterId).exec();
        if (!teamCluster) {
            return;
        }

        this.socketEmitter.emitToRoom(`team:${teamCluster.team}`, 'container.deploy.progress', {
            ...input,
            teamId: teamCluster.team.toString()
        } satisfies ContainerDeploymentProgressPayload);
    }
}

export default new ContainerDeploymentProgressService(socketIOEmitter);
