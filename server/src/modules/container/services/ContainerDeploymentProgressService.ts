import type SocketIOEmitter from '@modules/socket/services/SocketIOEmitter';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import TeamCluster from '@modules/cluster/models/TeamCluster';

interface ContainerDeploymentProgressPayload {
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

class ContainerDeploymentProgressService {
    constructor(
        private readonly socketEmitter: SocketIOEmitter
    ) {}

    async emitToTeam(input: Omit<ContainerDeploymentProgressPayload, 'teamId'>): Promise<void> {
        const teamCluster = await TeamCluster.findOneBy({ id: input.teamClusterId });
        if (!teamCluster) {
            return;
        }

        this.socketEmitter.emitToRoom(`team:${teamCluster.team}`, 'container.deploy.progress', {
            ...input,
            teamId: teamCluster.team
        } satisfies ContainerDeploymentProgressPayload);
    }
}

export default new ContainerDeploymentProgressService(socketIOEmitter);
