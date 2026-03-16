import type { ContainerCapabilities } from './container-capabilities';
import type { ContainerAccessiblePort } from './container-accessible-port';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type { User } from '@/modules/auth/api/entities/user';
import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { EnvVariable } from '@/modules/container/api/entities/env-variable';
import type { PortMapping } from '@/modules/container/api/entities/port-mapping';

export interface Container extends BaseEntity {
    name: string;
    image: string;
    containerId: string;
    folder: string | null;
    status: string;
    memory: number;
    cpus: number;
    internalIp?: string;
    team: string;
    teamCluster?: TeamCluster | string | null;
    createdBy: User | string;
    env: EnvVariable[];
    ports: PortMapping[];
    network?: string;
    volume?: string;
    mountDockerSocket?: boolean;
    capabilities?: ContainerCapabilities;
    accessiblePorts?: ContainerAccessiblePort[];
};
