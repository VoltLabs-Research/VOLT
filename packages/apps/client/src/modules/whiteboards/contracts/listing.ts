import type { Whiteboard, WhiteboardFolder } from '@volt/contracts/modules/whiteboards/domain';
import type { FolderedItemRow, FolderedListingRow } from '@/shared/ui/utils/foldered-listing-rows';

export interface WhiteboardFolderRowExtras {
    lastEditedBy: null;
    payloadKey: string;
    hierarchyTitle: string;
}

export interface WhiteboardItemRowExtras {
    hierarchyTitle: string;
}

export type WhiteboardItemRow = FolderedItemRow<Whiteboard, WhiteboardItemRowExtras>;

export type WhiteboardListingRow = FolderedListingRow<
    WhiteboardFolder,
    Whiteboard,
    WhiteboardFolderRowExtras,
    WhiteboardItemRowExtras
>;
