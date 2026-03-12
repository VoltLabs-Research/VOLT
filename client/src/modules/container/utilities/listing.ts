import type { Container } from '@/modules/container/api/entities/container';
import type { ContainerFolder } from '@/modules/container/api/entities/container-folder';

export enum ContainerListingRowType {
    Folder = 'folder',
    Container = 'container'
}

enum ContainerListingDndPrefix {
    Folder = 'folder',
    Container = 'container'
}

export interface ContainerFolderRow extends ContainerFolder {
    rowType: ContainerListingRowType.Folder;
    name: string;
    image: string;
    containerId: string;
    status: string;
    internalIp?: string;
    memory: number;
    cpus: number;
    team: string;
    teamCluster: null;
    createdBy: null;
    env: [];
    ports: [];
    folder: string | null;
}

export interface ContainerItemRow extends Container {
    rowType: ContainerListingRowType.Container;
}

export type ContainerListingRow = ContainerFolderRow | ContainerItemRow;

export const createContainerFolderRow = (folder: ContainerFolder): ContainerFolderRow => ({
    ...folder,
    rowType: ContainerListingRowType.Folder,
    name: folder.title,
    image: 'Folder',
    containerId: folder._id,
    status: 'folder',
    internalIp: undefined,
    memory: 0,
    cpus: 0,
    team: '',
    teamCluster: null,
    createdBy: null,
    env: [],
    ports: [],
    folder: folder.parent
});

export const createContainerItemRow = (container: Container): ContainerItemRow => ({
    ...container,
    rowType: ContainerListingRowType.Container
});

export const isContainerFolderRow = (row: ContainerListingRow): row is ContainerFolderRow => row.rowType === ContainerListingRowType.Folder;
export const isContainerItemRow = (row: ContainerListingRow): row is ContainerItemRow => row.rowType === ContainerListingRowType.Container;

export const getContainerListingDraggableId = (row: ContainerListingRow): string | null => {
    if (!isContainerItemRow(row)) {
        return null;
    }

    return `${ContainerListingDndPrefix.Container}:${row._id}`;
};

export const getContainerListingDroppableId = (row: ContainerListingRow): string | null => {
    if (!isContainerFolderRow(row)) {
        return null;
    }

    return `${ContainerListingDndPrefix.Folder}:${row._id}`;
};
