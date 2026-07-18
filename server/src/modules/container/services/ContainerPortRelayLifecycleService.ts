import { ContainerModel } from '@modules/container/models/ContainerModel';
import containerPortProxyRelayService, { ContainerPortProxyRelayService } from '@modules/container/services/ContainerPortProxyRelayService';
import logger from '@shared/infrastructure/logger';

export class ContainerPortRelayLifecycleService {
    constructor(
        private readonly relayService: ContainerPortProxyRelayService
    ) {}

    async start(): Promise<void> {
        const containers = await ContainerModel.find({ 'ports.public': { $gt: 0 } }).exec();
        const relays = containers.flatMap((container) => {
            if (!container.team || !container.teamCluster || !container.internalIp) {
                return [];
            }

            return container.ports
                .filter((port) => typeof port.public === 'number' && port.public > 0)
                .map((port) => ({
                    teamId: String(container.team),
                    containerId: String(container._id),
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

export default new ContainerPortRelayLifecycleService(containerPortProxyRelayService);
