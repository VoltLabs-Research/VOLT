import type { ContainerAccessiblePort } from './container-accessible-port';

export interface ContainerPortAccessUrl {
    url: string;
    expiresAt: string;
    port: ContainerAccessiblePort;
}
