import type { ContainerAccessiblePort } from './container-accessible-port';

export interface ContainerPortProxySession {
    url: string;
    expiresAt: string;
    port: ContainerAccessiblePort;
}
