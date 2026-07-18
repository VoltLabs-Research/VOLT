export interface ContainerPortRelayTarget {
    teamId: string;
    containerId: string;
    teamClusterId: string;
    internalIp: string;
    privatePort: number;
    publicPort: number;
}

export interface CreateContainerPortAccessUrlInput extends ContainerPortRelayTarget {
    userId: string;
}

export interface IContainerPortProxyRelayService {
    createAccessUrl(input: CreateContainerPortAccessUrlInput): Promise<{ url: string; expiresAt: string }>;
    ensureContainerRelays(relays: ContainerPortRelayTarget[]): Promise<void>;
    syncContainerRelays(containerId: string, relays: ContainerPortRelayTarget[]): Promise<void>;
    stopContainerRelays(containerId: string): Promise<void>;
    stopPublicPortRelays(publicPorts: number[]): Promise<void>;
    stopAll(): Promise<void>;
}
