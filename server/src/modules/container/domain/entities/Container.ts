import type { ContainerEnvironmentVariable, ContainerPortMapping } from '@modules/container/domain/port/IContainerService';

export interface ContainerAccessiblePort {
    private: number;
    public?: number;
    protocol: 'tcp';
    browserAccessible: boolean;
    status: 'available' | 'unavailable';
    label?: string;
};

export interface IContainerProps {
    name: string;
    image: string;
    containerId: string;
    folder: string | null;
    createdBy: string;
    status: string;
    memory: number;
    cpus: number;
    internalIp?: string;
    team?: string;
    teamCluster?: string;
    env: ContainerEnvironmentVariable[];
    ports: ContainerPortMapping[];
    network?: string;
    volume?: string;
    mountDockerSocket?: boolean;
    accessiblePorts?: ContainerAccessiblePort[];
    createdAt?: Date;
    updatedAt?: Date;
};

export class Container implements IContainerProps {
    public name!: string;
    public image!: string;
    public containerId!: string;
    public folder!: string | null;
    public createdBy!: string;
    public status!: string;
    public memory!: number;
    public cpus!: number;
    public internalIp?: string;
    public team?: string;
    public teamCluster?: string;
    public env!: ContainerEnvironmentVariable[];
    public ports!: ContainerPortMapping[];
    public network?: string;
    public volume?: string;
    public mountDockerSocket?: boolean;
    public accessiblePorts?: ContainerAccessiblePort[];
    public createdAt?: Date;
    public updatedAt?: Date;

    constructor(
        public readonly _id: string,
        props: IContainerProps
    ) {
        Object.assign(this, props);
    }
};
