import type { tags } from 'typia';
import type { PortMapping } from './domain';

interface ContainerPortMappingInput extends Required<PortMapping>{}

export interface ContainerRefInput{
    containerId: string;
}

export interface CreateContainerInput{
    name: string;
    image: string;
    tag?: string;
    ports?: ContainerPortMappingInput[];
    reason?: string;
}

export interface ListContainersInput{
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<50>;
}

export interface ListContainerFilesInput{
    containerId: string;
    path?: string & tags.Default<'/'>;
}

export interface ReadContainerFileInput{
    containerId: string;
    path: string;
}

export interface GetContainerPortAccessUrlInput{
    containerId: string;
    port: number;
}

export interface UpdateContainerInput{
    containerId: string;
    name?: string;
    reason?: string;
}

export interface MoveContainerInput{
    containerId: string;
    folderId: string | null;
}

export interface DeleteContainerInput{
    containerId: string;
    reason?: string;
}
