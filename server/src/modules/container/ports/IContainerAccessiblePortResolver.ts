import type { ContainerAccessiblePort } from '@modules/container/entities/Container';
import type { ContainerPortMapping } from '@modules/container/ports/IContainerService';

export interface IContainerAccessiblePortResolver {
    resolve(
        teamId: string,
        containerId: string,
        ports: ContainerPortMapping[],
        containerStatus: string
    ): ContainerAccessiblePort[];
}
