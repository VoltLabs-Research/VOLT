import type { Container, ContainerFolder } from '@volt/contracts/modules/container/domain';
import type { FolderedFolderRow, FolderedItemRow, FolderedListingRow } from '@/shared/ui/utils/foldered-listing-rows';

export interface ContainerFolderRowExtras {
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

export type ContainerFolderRow = FolderedFolderRow<ContainerFolder, ContainerFolderRowExtras>;

export type ContainerItemRow = FolderedItemRow<Container>;

export type ContainerListingRow = FolderedListingRow<ContainerFolder, Container, ContainerFolderRowExtras>;
