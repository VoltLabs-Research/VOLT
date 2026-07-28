import type { Identifiable } from '@/shared/contracts/entity';

export enum FolderedListingRowType {
    Folder = 'folder',
    Item = 'item'
}

const ROOT_DROPPABLE_ID = 'root';
const FOLDER_DROPPABLE_PREFIX = `${FolderedListingRowType.Folder}:`;

interface FolderedRowKind<TRowType extends FolderedListingRowType> {
    rowType: TRowType;
}

export type FolderedFolderRow<TFolder, TExtras = unknown> =
    TFolder & TExtras & FolderedRowKind<FolderedListingRowType.Folder>;

export type FolderedItemRow<TItem, TExtras = unknown> =
    TItem & TExtras & FolderedRowKind<FolderedListingRowType.Item>;

export type FolderedListingRow<TFolder, TItem, TFolderExtras = unknown, TItemExtras = unknown> =
    | FolderedFolderRow<TFolder, TFolderExtras>
    | FolderedItemRow<TItem, TItemExtras>;

interface CreateFolderedListingRowsOptions<TFolder, TItem, TFolderExtras, TItemExtras> {
    folderExtras?: (folder: TFolder) => TFolderExtras;
    itemExtras?: (item: TItem) => TItemExtras;
}

export const createFolderedListingRows = <
    TFolder extends Identifiable,
    TItem extends Identifiable,
    TFolderExtras = unknown,
    TItemExtras = unknown
>({
    folderExtras,
    itemExtras
}: CreateFolderedListingRowsOptions<TFolder, TItem, TFolderExtras, TItemExtras> = {}) => {
    type FolderRow = FolderedFolderRow<TFolder, TFolderExtras>;
    type ItemRow = FolderedItemRow<TItem, TItemExtras>;
    type Row = FolderRow | ItemRow;

    const isFolderRow = (row: Row): row is FolderRow => row.rowType === FolderedListingRowType.Folder;
    const isItemRow = (row: Row): row is ItemRow => row.rowType === FolderedListingRowType.Item;

    const getFolderDroppableId = (folderId: string | null): string => {
        return `${FOLDER_DROPPABLE_PREFIX}${folderId ?? ROOT_DROPPABLE_ID}`;
    };

    return {
        isFolderRow,
        isItemRow,
        getFolderDroppableId,
        mapFolderRow: (folder: TFolder): FolderRow => ({
            ...folder,
            ...folderExtras?.(folder),
            rowType: FolderedListingRowType.Folder
        } as FolderRow),
        mapItemRow: (item: TItem): ItemRow => ({
            ...item,
            ...itemExtras?.(item),
            rowType: FolderedListingRowType.Item
        } as ItemRow),
        getDraggableId: (row: Row): string | null => {
            return isItemRow(row) ? `${FolderedListingRowType.Item}:${row._id}` : null;
        },
        getDroppableId: (row: Row): string | null => {
            return isFolderRow(row) ? getFolderDroppableId(row._id) : null;
        },
        resolveDroppableFolderId: (droppableId: string): string | null | undefined => {
            if (!droppableId.startsWith(FOLDER_DROPPABLE_PREFIX)) {
                return undefined;
            }

            const folderId = droppableId.slice(FOLDER_DROPPABLE_PREFIX.length);
            if (folderId === ROOT_DROPPABLE_ID) {
                return null;
            }

            return folderId || undefined;
        }
    };
};
