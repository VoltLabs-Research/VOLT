import type { LammpsFolder, LammpsScript } from '@/modules/lammps/api/types';

export enum LammpsListingRowType {
    Folder = 'folder',
    Script = 'script'
}

enum LammpsListingDndPrefix {
    Folder = 'folder',
    Script = 'script'
}

export interface LammpsFolderRow extends LammpsFolder {
    rowType: LammpsListingRowType.Folder;
    lastEditedBy: null;
}

export interface LammpsScriptRow extends LammpsScript {
    rowType: LammpsListingRowType.Script;
}

export type LammpsListingRow = LammpsFolderRow | LammpsScriptRow;

export const createLammpsFolderRow = (folder: LammpsFolder): LammpsFolderRow => ({
    ...folder,
    rowType: LammpsListingRowType.Folder,
    lastEditedBy: null
});

export const createLammpsScriptRow = (script: LammpsScript): LammpsScriptRow => ({
    ...script,
    rowType: LammpsListingRowType.Script
});

export const isLammpsFolderRow = (row: LammpsListingRow): row is LammpsFolderRow => {
    return row.rowType === LammpsListingRowType.Folder;
};

export const isLammpsScriptRow = (row: LammpsListingRow): row is LammpsScriptRow => {
    return row.rowType === LammpsListingRowType.Script;
};

export const getLammpsListingDraggableId = (row: LammpsListingRow): string | null => {
    if (!isLammpsScriptRow(row)) {
        return null;
    }

    return `${LammpsListingDndPrefix.Script}:${row._id}`;
};

export const getLammpsListingDroppableId = (row: LammpsListingRow): string | null => {
    if (!isLammpsFolderRow(row)) {
        return null;
    }

    return `${LammpsListingDndPrefix.Folder}:${row._id}`;
};
