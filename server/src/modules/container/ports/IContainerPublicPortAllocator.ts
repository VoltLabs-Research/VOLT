import type { ContainerPortMapping } from '@modules/container/ports/IContainerService';

export interface ReservePortMappingsOptions {
    excludeContainerId?: string;
}

export interface ReservedPortMappings {
    ports: ContainerPortMapping[];
    reservedPublicPorts: number[];
}

export interface IContainerPublicPortAllocator {
    reservePortMappings(
        ports: ContainerPortMapping[] | undefined,
        options?: ReservePortMappingsOptions
    ): Promise<ReservedPortMappings>;
    commitReservations(publicPorts: number[]): void;
    releaseReservations(publicPorts: number[]): void;
    isInPublicRange(port: number): boolean;
}
