import type { LatexFolder } from '@/modules/latex/api/entities/latex-folder';
import type { LatexDocument } from '@/modules/latex/api/entities/latex-document';

export enum LatexListingRowType {
    Folder = 'folder',
    Document = 'document'
}

enum LatexListingDndPrefix {
    Folder = 'folder',
    Document = 'document'
}

export interface LatexFolderRow extends LatexFolder {
    rowType: LatexListingRowType.Folder;
    createdBy: null;
    lastEditedBy: null;
}

export interface LatexDocumentRow extends LatexDocument {
    rowType: LatexListingRowType.Document;
}

export type LatexListingRow = LatexFolderRow | LatexDocumentRow;

export const createLatexFolderRow = (folder: LatexFolder): LatexFolderRow => {
    return {
        ...folder,
        rowType: LatexListingRowType.Folder,
        createdBy: null,
        lastEditedBy: null
    };
};

export const createLatexDocumentRow = (document: LatexDocument): LatexDocumentRow => {
    return {
        ...document,
        rowType: LatexListingRowType.Document
    };
};

export const isLatexFolderRow = (row: LatexListingRow): row is LatexFolderRow => {
    return row.rowType === LatexListingRowType.Folder;
};

export const isLatexDocumentRow = (row: LatexListingRow): row is LatexDocumentRow => {
    return row.rowType === LatexListingRowType.Document;
};

export const getLatexListingDraggableId = (row: LatexListingRow): string | null => {
    if (!isLatexDocumentRow(row)) {
        return null;
    }

    return `${LatexListingDndPrefix.Document}:${row._id}`;
};

export const getLatexListingDroppableId = (row: LatexListingRow): string | null => {
    if (!isLatexFolderRow(row)) {
        return null;
    }

    return `${LatexListingDndPrefix.Folder}:${row._id}`;
};
