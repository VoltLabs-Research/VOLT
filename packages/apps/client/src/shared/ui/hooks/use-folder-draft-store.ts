import { create } from 'zustand';

// The folder being named in place of a listing, before it exists. Keyed per listing so the
// button that starts it and the grid that shows it don't have to share a component tree.
// Each draft gets its own id, so one that finishes late never takes away the next one.
interface FolderDraft {
    key: string;
    id: number;
}

interface FolderDraftState {
    draft: FolderDraft | null;
    nextId: number;
    start: (key: string) => void;
    discard: (key: string, id?: number) => void;
}

const useFolderDraftStore = create<FolderDraftState>((set) => ({
    draft: null,
    nextId: 1,
    start: (key) => set((state) => ({ draft: { key, id: state.nextId }, nextId: state.nextId + 1 })),
    discard: (key, id) => set((state) => {
        if (state.draft?.key !== key) return state;
        if (id !== undefined && state.draft.id !== id) return state;
        return { draft: null };
    })
}));

export const startFolderDraft = (key: string): void => {
    useFolderDraftStore.getState().start(key);
};

export const discardFolderDraft = (key: string, id?: number): void => {
    useFolderDraftStore.getState().discard(key, id);
};

// The id of the draft open in this listing, or null.
export const useFolderDraftId = (key: string): number | null =>
    useFolderDraftStore((state) => state.draft?.key === key ? state.draft.id : null);
