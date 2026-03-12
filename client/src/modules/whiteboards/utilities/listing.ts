import type { WhiteboardFolder } from '@/modules/whiteboards/api/entities/whiteboard-folder';
import type { Whiteboard } from '@/modules/whiteboards/api/entities/whiteboard';

export enum WhiteboardListingRowType {
    Folder = 'folder',
    Whiteboard = 'whiteboard'
};

enum WhiteboardListingDndPrefix {
    Folder = 'folder',
    Whiteboard = 'whiteboard'
};

export interface WhiteboardFolderRow extends WhiteboardFolder {
    rowType: WhiteboardListingRowType.Folder;
    lastEditedBy: null;
    payloadKey: string;
};

export interface WhiteboardItemRow extends Whiteboard {
    rowType: WhiteboardListingRowType.Whiteboard;
};

export type WhiteboardListingRow = WhiteboardFolderRow | WhiteboardItemRow;

export const createWhiteboardFolderRow = (folder: WhiteboardFolder): WhiteboardFolderRow => {
    return {
        ...folder,
        rowType: WhiteboardListingRowType.Folder,
        lastEditedBy: null,
        payloadKey: ''
    };
};

export const createWhiteboardItemRow = (whiteboard: Whiteboard): WhiteboardItemRow => {
    return {
        ...whiteboard,
        rowType: WhiteboardListingRowType.Whiteboard
    };
};

export const isWhiteboardFolderRow = (row: WhiteboardListingRow): row is WhiteboardFolderRow => {
    return row.rowType === WhiteboardListingRowType.Folder;
};

export const isWhiteboardItemRow = (row: WhiteboardListingRow): row is WhiteboardItemRow => {
    return row.rowType === WhiteboardListingRowType.Whiteboard;
};

export const getWhiteboardListingDraggableId = (row: WhiteboardListingRow): string | null => {
    if (!isWhiteboardItemRow(row)) {
        return null;
    }

    return `${WhiteboardListingDndPrefix.Whiteboard}:${row._id}`;
};

export const getWhiteboardListingDroppableId = (row: WhiteboardListingRow): string | null => {
    if (!isWhiteboardFolderRow(row)) {
        return null;
    }

    return `${WhiteboardListingDndPrefix.Folder}:${row._id}`;
};
