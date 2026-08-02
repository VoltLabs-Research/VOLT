import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import TeamCluster from '@modules/cluster/models/TeamCluster';

import type { ContainerDeployProgressEvent } from '@volt/contracts/modules/container/domain';

class ContainerDeploymentProgressService {
    async emitToTeam(input: Omit<ContainerDeployProgressEvent, 'teamId'>): Promise<void> {
        const teamCluster = await TeamCluster.findOneBy({ id: input.teamClusterId });
        if (!teamCluster) {
            return;
        }

        socketIOEmitter.emitToRoom(`team:${teamCluster.team}`, 'container.deploy.progress', {
            ...input,
            teamId: teamCluster.team
        } satisfies ContainerDeployProgressEvent);
    }
}

export default new ContainerDeploymentProgressService();
