import Container from '@modules/container/models/Container';
import containerPortProxyRelayService from '@modules/container/services/ContainerPortProxyRelayService';
import { toRelayTargets } from '@modules/container/services/container-network';
import logger from '@shared/infrastructure/logger';

/* Relays only exist in this process's memory, so every published port of every
   surviving container has to be re-bound on boot and released on shutdown. */

export class ContainerPortRelayLifecycleService{
    async start(): Promise<void>{
        const containers = await Container.find();
        const relays = containers.flatMap((container) => {
            if(!container.team || !container.teamCluster || !container.internalIp){
                return [];
            }

            return toRelayTargets({
                teamId: container.team,
                containerId: container.id,
                teamClusterId: container.teamCluster,
                internalIp: container.internalIp
            }, container.ports);
        });

        await containerPortProxyRelayService.ensureContainerRelays(relays);
        logger.info(`@container-port-relay: started ${relays.length} public port relay${relays.length === 1 ? '' : 's'}`);
    }

    async stop(): Promise<void>{
        await containerPortProxyRelayService.stopAll();
    }
}

export default new ContainerPortRelayLifecycleService();
