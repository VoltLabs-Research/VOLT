// Create
export interface CreateContainerInputDTO {
    name: string;
    image: string;
    teamId: string;
    userId: string;
    env?: Array<{ key: string; value: string }>;
    ports?: Array<{ private: number; public: number }>;
    cmd?: string[];
    memory?: number;
    cpus?: number;
    mountDockerSocket?: boolean;
    useImageCmd?: boolean;
}

export interface CreateContainerOutputDTO {
    container: any;
}

// Update
export interface UpdateContainerInputDTO {
    id: string;
    action?: 'start' | 'stop' | 'restart';
    env?: Array<{ key: string; value: string }>;
    ports?: Array<{ private: number; public: number }>;
    // other update fields if needed
}

export interface UpdateContainerOutputDTO {
    container: any;
    status?: string;
}

// List
export interface ListContainersOutputDTO {
    containers: any[];
}

// Get
export interface GetContainerStatsOutputDTO {
    stats: any;
    limits: { memory: number; cpus: number };
}

export interface GetContainerProcessesOutputDTO {
    processes: any[];
}

export interface GetContainerByIdOutputDTO {
    container: any;
}

export interface DeleteContainerOutputDTO {
    message: string;
}
