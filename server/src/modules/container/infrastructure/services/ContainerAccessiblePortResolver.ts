import { buildContainerPortProxyBasePath } from '@modules/container/infrastructure/utilities/container-port-proxy';
import { injectable } from 'tsyringe';
import type { ContainerAccessiblePort } from '@modules/container/domain/entities/Container';
import type { ContainerPortMapping } from '@modules/container/domain/port/IContainerService';

const BROWSER_ACCESSIBLE_PORTS = new Set<number>([3000, 4173, 5173, 7080, 8000, 8080, 8888]);

@injectable()
export class ContainerAccessiblePortResolver {
    resolve(
        teamId: string,
        containerId: string,
        ports: ContainerPortMapping[],
        containerStatus: string
    ): ContainerAccessiblePort[] {
        return ports.map((port) => {
            const browserAccessible = BROWSER_ACCESSIBLE_PORTS.has(port.private);
            const status = containerStatus === 'running'
                ? 'available'
                : 'unavailable';

            return {
                private: port.private,
                public: port.public,
                protocol: 'tcp',
                browserAccessible,
                status,
                ...(browserAccessible ? {
                    label: buildContainerPortProxyBasePath(teamId, containerId, port.private)
                } : {})
            };
        });
    }
}
