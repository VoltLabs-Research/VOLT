export interface BootstrapState{
    done: boolean;
    email: string;
    password: string;
    userId: string;
    teamId: string;
    teamClusterId: string;
    authToken: string;
    daemonPassword: string;
}

export interface PluginSeedState{
    done: boolean;
    teamId: string;
    installed: string[];
    platform?: string;
}

// Where a host keeps the provisioning state between starts: the desktop's config file, the browser's storage.
export interface BootstrapStore{
    getBootstrap(): Promise<BootstrapState | null>;
    setBootstrap(state: BootstrapState): Promise<void>;
    clearBootstrap(): Promise<void>;
}

export interface PluginSeedStore{
    getPluginSeed(): Promise<PluginSeedState | null>;
    setPluginSeed(state: PluginSeedState): Promise<void>;
    clearPluginSeed(): Promise<void>;
}

export type ProvisioningLog = (stream: 'stdout' | 'stderr', line: string) => void;
