import type { Whiteboard, WhiteboardFolder } from '@volt/contracts/modules/whiteboards/domain';
import type { WhiteboardFolderRowExtras, WhiteboardItemRowExtras } from '@/modules/whiteboards/contracts/listing';
import { createFolderedListingRows } from '@/shared/ui/utils/foldered-listing-rows';
import { resolveListingItemTitle } from '@/shared/ui/utils/listing-messages';

export const {
    mapFolderRow: createWhiteboardFolderRow,
    mapItemRow: createWhiteboardItemRow,
    isFolderRow: isWhiteboardFolderRow,
    isItemRow: isWhiteboardItemRow,
    getDraggableId: getWhiteboardListingDraggableId,
    getDroppableId: getWhiteboardListingDroppableId
} = createFolderedListingRows<WhiteboardFolder, Whiteboard, WhiteboardFolderRowExtras, WhiteboardItemRowExtras>({
    folderExtras: (folder) => ({
        lastEditedBy: null,
        payloadKey: '',
        hierarchyTitle: resolveListingItemTitle(folder, 'Untitled Folder')
    }),
    itemExtras: (whiteboard) => ({
        hierarchyTitle: resolveListingItemTitle(whiteboard, 'Untitled Whiteboard')
    })
});
