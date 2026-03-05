interface ContainerProcess {
    pid: string;
    program: string;
    threads: string;
    user: string;
    memory: string;
    cpu: string;
    command: string;
};

export type RawContainerProcess = string[];
