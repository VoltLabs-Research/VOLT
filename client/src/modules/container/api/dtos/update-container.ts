import type { EnvVariable } from '@/modules/container/api/entities/env-variable';
import type { PortMapping } from '@/modules/container/api/entities/port-mapping';

export type ContainerAction = 'start' | 'stop' | 'restart';

export interface UpdateContainerFields {
    action?: ContainerAction;
    env?: EnvVariable[];
    ports?: PortMapping[];
};

export interface UpdateContainerParams extends UpdateContainerFields {
    containerId: string;
};
