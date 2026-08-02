import Container from '@modules/container/models/Container';
import containerPortProxyRelayService, { ContainerPortProxyRelayService } from '@modules/container/services/ContainerPortProxyRelayService';
import logger from '@shared/infrastructure/logger';

export class ContainerPortRelayLifecycleService{
    constructor(
        private readonly relayService: ContainerPortProxyRelayService
    ){}

    async start(): Promise<void>{
        const containers = await Container.find();
        const relays = containers.flatMap((container) => {
            if(!container.team || !container.teamCluster || !container.internalIp){
                return [];
            }

            return container.ports
                .filter((port) => (port.public ?? 0) > 0)
                .map((port) => ({
                    teamId: container.team as string,
                    containerId: container.id,
                    teamClusterId: container.teamCluster,
                    internalIp: container.internalIp as string,
                    privatePort: port.private,
                    publicPort: port.public as number
                }));
        });

        await this.relayService.ensureContainerRelays(relays);
        logger.info(`@container-port-relay: started ${relays.length} public port relay${relays.length === 1 ? '' : 's'}`);
    }

    async stop(): Promise<void>{
        await this.relayService.stopAll();
    }
}

export default new ContainerPortRelayLifecycleService(containerPortProxyRelayService);
