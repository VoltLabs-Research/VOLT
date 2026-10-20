import { create } from 'zustand';

interface SceneMergePreviewStore {
    draggedSceneKey: string | null;
    candidateSceneKey: string | null;
    setMergePreview: (draggedSceneKey: string | null, candidateSceneKey: string | null) => void;
    clearMergePreview: () => void;
}

export const useSceneMergePreviewStore = create<SceneMergePreviewStore>((set) => ({
    draggedSceneKey: null,
    candidateSceneKey: null,

    setMergePreview: (draggedSceneKey, candidateSceneKey) => set((state) => {
        if (state.draggedSceneKey === draggedSceneKey && state.candidateSceneKey === candidateSceneKey) {
            return state;
        }

        return {
            draggedSceneKey,
            candidateSceneKey
        };
    }),

    clearMergePreview: () => set((state) => {
        if (state.draggedSceneKey === null && state.candidateSceneKey === null) {
            return state;
        }

        return {
            draggedSceneKey: null,
            candidateSceneKey: null
        };
    })
}));
