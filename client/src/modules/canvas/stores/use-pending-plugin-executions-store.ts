import { create } from 'zustand';

export interface PendingPluginExecution {
    analysisId: string;
    trajectoryId: string;
    pluginName: string;
    timestep?: number;
    autoSelect: boolean;
    toastId?: string;
    completedFrames?: number;
    totalFrames?: number;
};

interface PendingPluginExecutionsState {
    entries: Record<string, PendingPluginExecution>;
    register: (entry: PendingPluginExecution) => void;
    update: (analysisId: string, patch: Partial<PendingPluginExecution>) => void;
    get: (analysisId: string) => PendingPluginExecution | undefined;
    remove: (analysisId: string) => PendingPluginExecution | undefined;
};

export const usePendingPluginExecutionsStore = create<PendingPluginExecutionsState>((set, getState) => ({
    entries: {},
    register: (entry) => {
        set((state) => ({
            entries: {
                ...state.entries,
                [entry.analysisId]: entry
            }
        }));
    },
    update: (analysisId, patch) => {
        set((state) => {
            const current = state.entries[analysisId];
            if (!current) {
                return state;
            }
            return {
                entries: {
                    ...state.entries,
                    [analysisId]: { ...current, ...patch }
                }
            };
        });
    },
    get: (analysisId) => getState().entries[analysisId],
    remove: (analysisId) => {
        const current = getState().entries[analysisId];
        if (!current) {
            return undefined;
        }
        set((state) => {
            const next = { ...state.entries };
            delete next[analysisId];
            return { entries: next };
        });
        return current;
    }
}));
