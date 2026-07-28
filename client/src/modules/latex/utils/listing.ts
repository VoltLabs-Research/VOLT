import type { LatexDocument, LatexFolder } from '@volt/contracts/modules/latex/domain';
import type { LatexFolderRowExtras } from '@/modules/latex/contracts/listing';
import { createFolderedListingRows } from '@/shared/ui/utils/foldered-listing-rows';

export const {
    mapFolderRow: createLatexFolderRow,
    mapItemRow: createLatexDocumentRow,
    isFolderRow: isLatexFolderRow,
    isItemRow: isLatexDocumentRow,
    getDraggableId: getLatexListingDraggableId,
    getDroppableId: getLatexListingDroppableId
} = createFolderedListingRows<LatexFolder, LatexDocument, LatexFolderRowExtras>({
    folderExtras: () => ({
        createdBy: null,
        lastEditedBy: null
    })
});
