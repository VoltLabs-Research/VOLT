import type { EnvVariable } from '@/modules/container/api/entities/env-variable';
import type { PortMapping } from '@/modules/container/api/entities/port-mapping';

export enum ContainerAction {
    Start = 'start',
    Stop = 'stop',
    Restart = 'restart'
}

export interface UpdateContainerFields {
    action?: ContainerAction;
    env?: EnvVariable[];
    ports?: PortMapping[];
}

export interface UpdateContainerParams extends UpdateContainerFields {
    containerId: string;
}
