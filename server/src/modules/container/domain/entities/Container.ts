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
    env: Array<{ key: string; value: string }>;
    ports: Array<{ private: number; public: number }>;
    network?: string;
    volume?: string;
    createdAt?: Date;
    updatedAt?: Date;
    _id?: string;
}

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
    public env!: Array<{ key: string; value: string }>;
    public ports!: Array<{ private: number; public: number }>;
    public network?: string;
    public volume?: string;
    public createdAt?: Date;
    public updatedAt?: Date;
    public _id?: string;

    constructor(
        public readonly id: string,
        props: IContainerProps
    ){
        Object.assign(this, props);
    }
}
