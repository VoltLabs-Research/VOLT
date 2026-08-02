import type {
    LatexWorkspaceSelection,
    LatexWorkspaceTab,
    LatexEditorGroup,
    LatexEditorGroupId,
    FileEditorState
} from '@/modules/latex/contracts/workspace';

export const AUTOSAVE_DELAY = 500;

export const LIVE_COMPILE_DELAY = 800;
const TEX_EXTENSION = '.tex';
export const PRIMARY_EDITOR_GROUP_ID = 'primary' as const;
export const SECONDARY_EDITOR_GROUP_ID = 'secondary' as const;
export const EDITOR_GROUP_IDS = [PRIMARY_EDITOR_GROUP_ID, SECONDARY_EDITOR_GROUP_ID] as const;

export const isTexFile = (name: string): boolean => name.toLowerCase().endsWith(TEX_EXTENSION);

export const isSameSelection = (left: LatexWorkspaceSelection, right: LatexWorkspaceSelection): boolean => {
    if (!left || !right) {
        return left === right;
    }

    return left.type === right.type && left.id === right.id;
};

export const isSameTab = (left: LatexWorkspaceTab, right: LatexWorkspaceTab): boolean => {
    return left.type === right.type && left.id === right.id;
};

/** After closing a tab, focus moves to the tab that slid into its slot, else the one before it. */
export const getNextSelectionAfterClose = (
    tabs: LatexWorkspaceTab[],
    tabToClose: LatexWorkspaceTab,
    currentSelection: LatexWorkspaceSelection
): LatexWorkspaceSelection => {
    if (!isSameSelection(currentSelection, tabToClose)) {
        return currentSelection;
    }

    const tabIndex = tabs.findIndex((currentTab) => isSameTab(currentTab, tabToClose));
    if (tabIndex < 0) {
        return currentSelection;
    }

    const nextTabs = tabs.filter((_, index) => index !== tabIndex);
    return nextTabs[tabIndex] ?? nextTabs[tabIndex - 1] ?? null;
};

export const createEditorGroup = (id: LatexEditorGroupId): LatexEditorGroup => ({
    id,
    selection: null,
    openTabs: []
});

export const createFileEditorState = (content: string): FileEditorState => ({
    content,
    lastSavedContent: content,
    remoteContent: content,
    isDirty: false
});
