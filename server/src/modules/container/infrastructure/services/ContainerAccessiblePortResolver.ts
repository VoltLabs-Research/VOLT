import { injectable } from 'tsyringe';
import type { ContainerAccessiblePort } from '@modules/container/domain/entities/Container';
import type { ContainerPortMapping } from '@modules/container/domain/port/IContainerService';

@injectable()
export class ContainerAccessiblePortResolver {
    resolve(
        _teamId: string,
        _containerId: string,
        ports: ContainerPortMapping[],
        containerStatus: string
    ): ContainerAccessiblePort[] {
        return ports.map((port) => {
            const status = containerStatus === 'running'
                ? 'available'
                : 'unavailable';

            return {
                private: port.private,
                public: port.public,
                protocol: 'tcp',
                browserAccessible: true,
                status
            };
        });
    }
}
