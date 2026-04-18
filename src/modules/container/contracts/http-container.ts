export interface ContainerEnvironmentVariable {
    key: string;
    value: string;
};

export interface ContainerPortMapping {
    private: number;
    public?: number;
};

export interface CreateContainerRequest {
    image: string;
    name: string;
    operationId?: string;
    user?: string;
    env?: ContainerEnvironmentVariable[];
    ports?: ContainerPortMapping[];
    memoryInMegabytes: number;
    cpus: number;
    binds?: string[];
    labels?: Record<string, string>;
    networkMode?: string;
    cmd?: string[];
};

export enum ContainerAction {
    Start = 'start',
    Stop = 'stop',
    Restart = 'restart'
};
