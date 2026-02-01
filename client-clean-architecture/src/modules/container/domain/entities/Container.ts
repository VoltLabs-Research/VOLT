export interface PortMapping {
    private: number;
    public: number;
};

export interface EnvVariable {
    key: string;
    value: string;
};

export interface Container {
    _id: string;
    name: string;
    image: string;
    containerId: string;
    status: string;
    memory: number;
    cpus: number;
    internalIp?: string;
    team: string;
    createdBy: string;
    env: EnvVariable[];
    ports: PortMapping[];
    network?: string;
    volume?: string;
    createdAt: string;
    updatedAt: string;
};
