import { create } from 'zustand';

export interface PendingExecutionIntent {
    pluginId: string;
    config: Record<string, unknown>;
    selectedTimesteps?: number[];
    timestep?: number;
    targetClusterId: string;
};

export interface CloneFlowEntry {
    jobId: string;
    sourceTrajectoryId: string;
    destinationTrajectoryId: string;
    pendingIntent?: PendingExecutionIntent;
    toastId?: string;
    totalFrames: number;
    copiedFrames: number;
    state: 'queued' | 'preparing' | 'copying' | 'completed' | 'failed';
};

interface TrajectoryCloneFlowState {
    entries: Record<string, CloneFlowEntry>;
    addEntry: (entry: CloneFlowEntry) => void;
    updateEntry: (destinationTrajectoryId: string, patch: Partial<CloneFlowEntry>) => void;
    setToastId: (destinationTrajectoryId: string, toastId: string | undefined) => void;
    consumeIntent: (destinationTrajectoryId: string) => PendingExecutionIntent | undefined;
    removeEntry: (destinationTrajectoryId: string) => void;
};

export const useTrajectoryCloneFlowStore = create<TrajectoryCloneFlowState>((set, get) => ({
    entries: {},
    addEntry: (entry) => {
        set((state) => ({
            entries: {
                ...state.entries,
                [entry.destinationTrajectoryId]: entry
            }
        }));
    },
    updateEntry: (destinationTrajectoryId, patch) => {
        set((state) => {
            const current = state.entries[destinationTrajectoryId];
            if (!current) {
                return state;
            }
            return {
                entries: {
                    ...state.entries,
                    [destinationTrajectoryId]: { ...current, ...patch }
                }
            };
        });
    },
    setToastId: (destinationTrajectoryId, toastId) => {
        set((state) => {
            const current = state.entries[destinationTrajectoryId];
            if (!current) {
                return state;
            }
            return {
                entries: {
                    ...state.entries,
                    [destinationTrajectoryId]: { ...current, toastId }
                }
            };
        });
    },
    consumeIntent: (destinationTrajectoryId) => {
        const current = get().entries[destinationTrajectoryId];
        if (!current?.pendingIntent) {
            return undefined;
        }
        const intent = current.pendingIntent;
        set((state) => {
            const entry = state.entries[destinationTrajectoryId];
            if (!entry) {
                return state;
            }
            return {
                entries: {
                    ...state.entries,
                    [destinationTrajectoryId]: { ...entry, pendingIntent: undefined }
                }
            };
        });
        return intent;
    },
    removeEntry: (destinationTrajectoryId) => {
        set((state) => {
            const next = { ...state.entries };
            delete next[destinationTrajectoryId];
            return { entries: next };
        });
    }
}));
