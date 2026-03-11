import type { ContainerCapabilities } from './container-capabilities';
import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { EnvVariable } from '@/modules/container/api/entities/env-variable';
import type { PortMapping } from '@/modules/container/api/entities/port-mapping';

export interface Container extends BaseEntity {
    name: string;
    image: string;
    containerId: string;
    status: string;
    memory: number;
    cpus: number;
    internalIp?: string;
    team: string;
    teamCluster?: string;
    createdBy: string;
    env: EnvVariable[];
    ports: PortMapping[];
    network?: string;
    volume?: string;
    mountDockerSocket?: boolean;
    capabilities?: ContainerCapabilities;
};
