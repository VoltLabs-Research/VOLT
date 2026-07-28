

import type { EnvVariable, PortMapping } from './domain';

export interface CreateContainerInput{
    name: string;
    image: string;
    operationId?: string;
    teamClusterId?: string;
    folderId?: string | null;
    env?: EnvVariable[];
    ports?: PortMapping[];
    cmd?: string[];
    memory?: number;
    cpus?: number;
    mountDockerSocket?: boolean;
    useImageCmd?: boolean;
}

export interface UpdateContainerInput{
    teamClusterId?: string;
    action?: 'start' | 'stop' | 'restart';
    env?: EnvVariable[];
    ports?: PortMapping[];
}

export interface MoveContainerInput{
    folderId: string | null;
}

export interface CreateContainerFolderInput{
    title: string;
    parentId?: string | null;
}

export interface UpdateContainerFolderInput{
    title: string;
}
