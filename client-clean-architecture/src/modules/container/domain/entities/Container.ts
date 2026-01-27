export interface Container {
    _id: string;
    name: string;
    image: string;
    status: string;
    [key: string]: any;
}

export interface ContainerStats {
    cpu: number;
    memory: number;
    [key: string]: any;
}

export interface ContainerProcess {
    pid: string;
    user: string;
    command: string;
    [key: string]: any;
}
