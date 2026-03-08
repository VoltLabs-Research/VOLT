import type { ContainerEnvironmentVariable, ContainerPortMapping } from '@modules/container/domain/port/IContainerService';

export interface IContainerProps {
    name: string;
    image: string;
    containerId: string;
    createdBy: string;
    status: string;
    memory: number;
    cpus: number;
    internalIp?: string;
    team?: string;
    env: ContainerEnvironmentVariable[];
    ports: ContainerPortMapping[];
    network?: string;
    volume?: string;
    createdAt?: Date;
    updatedAt?: Date;
};

export class Container implements IContainerProps {
    public name!: string;
    public image!: string;
    public containerId!: string;
    public createdBy!: string;
    public status!: string;
    public memory!: number;
    public cpus!: number;
    public internalIp?: string;
    public team?: string;
    public env!: ContainerEnvironmentVariable[];
    public ports!: ContainerPortMapping[];
    public network?: string;
    public volume?: string;
    public createdAt?: Date;
    public updatedAt?: Date;

    constructor(
        public readonly _id: string,
        props: IContainerProps
    ) {
        Object.assign(this, props);
    }
};
