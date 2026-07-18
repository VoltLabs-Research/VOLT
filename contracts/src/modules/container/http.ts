// Wire request bodies the CLIENT sends. Server-derived context (the
// authenticated userId, the `:teamId`/`:containerId` path params) is NOT here —
// the service augments those on its own input.

import type { ContainerEnvironmentVariable, ContainerPortMapping } from './domain';

export interface CreateContainerInput{
    name: string;
    image: string;
    operationId?: string;
    teamClusterId?: string;
    folderId?: string | null;
    env?: ContainerEnvironmentVariable[];
    ports?: ContainerPortMapping[];
    cmd?: string[];
    memory?: number;
    cpus?: number;
    mountDockerSocket?: boolean;
    useImageCmd?: boolean;
}

export interface UpdateContainerInput{
    teamClusterId?: string;
    action?: 'start' | 'stop' | 'restart';
    env?: ContainerEnvironmentVariable[];
    ports?: ContainerPortMapping[];
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
