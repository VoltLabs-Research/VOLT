import type { ContainerAccessiblePort } from '@modules/container/domain/entities/Container';
import type { ContainerPortMapping } from '@modules/container/domain/port/IContainerService';

export interface IContainerAccessiblePortResolver {
    resolve(
        teamId: string,
        containerId: string,
        ports: ContainerPortMapping[],
        containerStatus: string
    ): ContainerAccessiblePort[];
}
