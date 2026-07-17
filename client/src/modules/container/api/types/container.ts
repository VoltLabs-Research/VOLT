import type { ContainerAccessiblePort } from './container-accessible-port';
import type { TeamCluster } from '@/modules/cluster/api/types/team-cluster';
import type { User } from '@/modules/auth/api/types/user';
import type { BaseEntity } from '@/shared/types/BaseEntity';
import type { EnvVariable } from '@/modules/container/api/types/env-variable';
import type { PortMapping } from '@/modules/container/api/types/port-mapping';

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
    accessiblePorts?: ContainerAccessiblePort[];
}
