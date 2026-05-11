import { ContainerRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerRepository';
import { ContainerPortProxyRelayService } from '@modules/container/infrastructure/services/ContainerPortProxyRelayService';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';

@Singleton()
export class ContainerPortRelayLifecycleService {
    constructor(
        private readonly containerRepository: ContainerRepository,
        private readonly relayService: ContainerPortProxyRelayService
    ) {}

    async start(): Promise<void> {
        const containers = await this.containerRepository.findWithPublicPorts();
        const relays = containers.flatMap((container) => {
            if (!container.team || !container.teamCluster || !container.internalIp) {
                return [];
            }

            return container.ports
                .filter((port) => typeof port.public === 'number' && port.public > 0)
                .map((port) => ({
                    teamId: String(container.team),
                    containerId: container._id,
                    teamClusterId: String(container.teamCluster),
                    internalIp: container.internalIp as string,
                    privatePort: port.private,
                    publicPort: port.public as number
                }));
        });

        await this.relayService.ensureContainerRelays(relays);
        logger.info(`@container-port-relay: started ${relays.length} public port relay${relays.length === 1 ? '' : 's'}`);
    }

    async stop(): Promise<void> {
        await this.relayService.stopAll();
    }
}
