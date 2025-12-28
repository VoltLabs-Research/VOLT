export interface Container {
    _id: string;
    name: string;
    image: string;
    status: string;
    [key: string]: any;
}

export interface GetContainersParams {
    page?: number;
    limit?: number;
    search?: string;
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

export interface CreateContainerPayload {
    name: string;
    image: string;
    team?: string;
    env?: { key: string; value: string }[];
    volumes?: string[];
    ports?: { private: number; public: number }[];
    [key: string]: any;
}
