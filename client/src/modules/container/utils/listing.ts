import type { Container, ContainerFolder } from '@volt/contracts/modules/container/domain';
import type { ContainerFolderRowExtras } from '@/modules/container/contracts/listing';
import { createFolderedListingRows } from '@/shared/ui/utils/foldered-listing-rows';

export const {
    mapFolderRow: createContainerFolderRow,
    mapItemRow: createContainerItemRow,
    isFolderRow: isContainerFolderRow,
    isItemRow: isContainerItemRow,
    getDraggableId: getContainerListingDraggableId,
    getDroppableId: getContainerListingDroppableId
} = createFolderedListingRows<ContainerFolder, Container, ContainerFolderRowExtras>({
    folderExtras: (folder) => ({
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
    })
});
