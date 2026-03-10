import type { ContainerEnvironmentVariable, ContainerPortMapping, CreateRuntimeContainerOptions } from '@modules/container/domain/port/IContainerService';

interface PortBinding {
    HostPort: string;
};

interface PortConfig {
    portBindings: Record<string, PortBinding[]>;
    exposedPorts: Record<string, Record<string, never>>;
};

interface DockerHostConfig {
    PortBindings: Record<string, PortBinding[]>;
    Memory: number;
    NanoCpus: number;
    Binds?: string[];
    GroupAdd?: string[];
};

export interface DockerContainerConfig {
    Image: string;
    name: string;
    Env: string[];
    Labels?: Record<string, string>;
    ExposedPorts: Record<string, Record<string, never>>;
    HostConfig: DockerHostConfig;
    Tty: boolean;
    Cmd?: string[];
};

const formatEnvEntries = (entries: ContainerEnvironmentVariable[]): string[] => {
    return entries.map((entry) => `${entry.key}=${entry.value}`);
};

const buildPortConfig = (ports: ContainerPortMapping[]): PortConfig => {
    const portBindings: Record<string, PortBinding[]> = {};
    const exposedPorts: Record<string, Record<string, never>> = {};

    for (const portMapping of ports) {
        const portKey = `${portMapping.private}/tcp`;
        exposedPorts[portKey] = {};
        portBindings[portKey] = [{ HostPort: typeof portMapping.public === 'number' && portMapping.public > 0 ? String(portMapping.public) : '' }];
    }

    return {
        portBindings,
        exposedPorts
    };
};

const buildDockerHostConfig = (
    options: Omit<CreateRuntimeContainerOptions, 'image' | 'name' | 'env' | 'cmd'>
): DockerHostConfig => {
    const emptyPortConfig: PortConfig = {
        portBindings: {},
        exposedPorts: {}
    };
    const { portBindings } = options.ports ? buildPortConfig(options.ports) : emptyPortConfig;
    const hostConfig: DockerHostConfig = {
        PortBindings: portBindings,
        Memory: options.memoryInMegabytes * 1024 * 1024,
        NanoCpus: options.cpus * 1_000_000_000
    };

    if (options.binds && options.binds.length > 0) {
        hostConfig.Binds = options.binds;
    }

    if (options.groupAdd && options.groupAdd.length > 0) {
        hostConfig.GroupAdd = options.groupAdd;
    }

    return hostConfig;
};

export const buildDockerContainerConfig = (
    options: CreateRuntimeContainerOptions
): DockerContainerConfig => {
    const formattedEnv = options.env ? formatEnvEntries(options.env) : [];
    const emptyPortConfig: PortConfig = {
        portBindings: {},
        exposedPorts: {}
    };
    const { exposedPorts } = options.ports ? buildPortConfig(options.ports) : emptyPortConfig;
    const dockerConfig: DockerContainerConfig = {
        Image: options.image,
        name: options.name,
        Env: formattedEnv,
        Labels: options.labels,
        ExposedPorts: exposedPorts,
        HostConfig: buildDockerHostConfig({
            ports: options.ports,
            memoryInMegabytes: options.memoryInMegabytes,
            cpus: options.cpus,
            binds: options.binds,
            groupAdd: options.groupAdd
        }),
        Tty: true
    };

    if (options.cmd && options.cmd.length > 0) {
        dockerConfig.Cmd = options.cmd;
    }

    return dockerConfig;
};
