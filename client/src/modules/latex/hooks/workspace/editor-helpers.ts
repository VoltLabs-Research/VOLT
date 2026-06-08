import type {
    LatexWorkspaceSelection,
    LatexWorkspaceTab,
    LatexEditorGroup,
    LatexEditorGroupId,
    FileEditorState
} from './types';

export const AUTOSAVE_DELAY = 500;
/**
 * Debounce before triggering a background recompile while editing. Slightly
 * larger than AUTOSAVE_DELAY so the collaborative Yjs update has time to be
 * persisted server-side before the compile reads the stored content.
 */
export const LIVE_COMPILE_DELAY = 800;
export const TEX_EXTENSION = '.tex';
export const PRIMARY_EDITOR_GROUP_ID = 'primary' as const;
export const SECONDARY_EDITOR_GROUP_ID = 'secondary' as const;

export const isSameSelection = (left: LatexWorkspaceSelection, right: LatexWorkspaceSelection): boolean => {
    if (!left || !right) {
        return left === right;
    }

    return left.type === right.type && left.id === right.id;
};

export const isSameTab = (left: LatexWorkspaceTab, right: LatexWorkspaceTab): boolean => {
    return left.type === right.type && left.id === right.id;
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
