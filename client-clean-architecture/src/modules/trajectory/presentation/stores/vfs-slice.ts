import { runRequest } from '@/shared/presentation/stores/helpers';
import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import type { Trajectory } from '@/types/models';
import { trajectoryRepository } from '@/modules/trajectory/infrastructure/repositories/TrajectoryRepository';

type EntryType = 'file' | 'dir';

export interface FsEntry {
    type: EntryType;
    name: string;
    relPath: string;
    size?: number;
    mtime?: string;
    ext?: string | null;
    mime?: string | false;
}

interface HistoryItem {
    cwd: string;
}

export interface TrajectoryVfsState {
    cwd: string;
    entries: FsEntry[];
    breadcrumbs: Array<{ name: string; relPath: string }>;
    selected: string | null;

    loading: boolean;
    error: string | null;

    showHidden: boolean;

    history: HistoryItem[];
    historyIndex: number;

    trajectories: Trajectory[];
    loadingTrajectories: boolean;
    currentTrajectoryId: string | null;
}

export interface TrajectoryVfsActions {
    init: () => Promise<void>;

    open: (relPath?: string) => Promise<void>;
    enter: (name: string) => Promise<void>;
    up: () => Promise<void>;

    back: () => Promise<void>;
    forward: () => Promise<void>;
    refresh: () => Promise<void>;

    select: (relPath: string | null) => void;
    download: (relPath: string) => Promise<void>;

    setShowHidden: (v: boolean) => Promise<void>;

    fetchTrajectories: () => Promise<void>;
    navigateToTrajectory: (trajectoryId: string) => Promise<void>;
}

export type TrajectoryVfsSlice = TrajectoryVfsState & TrajectoryVfsActions;

export const initialState: TrajectoryVfsState = {
    cwd: '',
    entries: [],
    breadcrumbs: [{ name: 'root', relPath: '' }],
    selected: null,

    loading: false,
    error: null,

    showHidden: false,

    trajectories: [],
    loadingTrajectories: false,
    currentTrajectoryId: null,

    history: [{ cwd: '' }],
    historyIndex: 0
};

let isVfsInitialized = false;

export const createTrajectoryVfsSlice: SliceCreator<TrajectoryVfsSlice> = (set, get) => ({
    ...initialState,

    init: async () => {
        if (isVfsInitialized) return;

        set({ ...initialState } as TrajectoryVfsSlice);

        const slice = get() as TrajectoryVfsSlice;

        await slice.fetchTrajectories();
        await slice.open('');

        isVfsInitialized = true;
    },

    open: async (relPath = '') => {
        const slice = get() as TrajectoryVfsSlice;

        const connectionId = slice.currentTrajectoryId ?? 'root';
        const path = relPath;

        await runRequest(set, get, () => trajectoryRepository.vfsList(connectionId, path), {
            errorFallback: 'Error loading files',
            loadingKey: 'loading',
            onSuccess: (response: any) => {
                set((state: TrajectoryVfsSlice) => {
                    const historyUntilNow = state.history.slice(0, state.historyIndex + 1);
                    const { cwd, entries, breadcrumbs, selected } = response.data ?? response;
                    const nextHistory = [...historyUntilNow, { cwd }];

                    return {
                        cwd,
                        entries,
                        breadcrumbs,
                        selected,
                        history: nextHistory,
                        historyIndex: nextHistory.length - 1
                    };
                });
            }
        });
    },

    enter: async (name) => {
        const slice = get() as TrajectoryVfsSlice;

        const nextPath = slice.cwd ? `${slice.cwd}/${name}` : name;

        await slice.open(nextPath);
    },

    up: async () => {
        const slice = get() as TrajectoryVfsSlice;

        if (!slice.cwd) {
            return;
        }

        const parentPath = slice.cwd.split('/').slice(0, -1).join('/');

        await slice.open(parentPath);
    },

    back: async () => {
        const slice = get() as TrajectoryVfsSlice;

        if (slice.historyIndex <= 0) {
            return;
        }

        set({ historyIndex: slice.historyIndex - 1 } as Partial<TrajectoryVfsSlice>);
        await slice.refresh();
    },

    forward: async () => {
        const slice = get() as TrajectoryVfsSlice;

        if (slice.historyIndex >= slice.history.length - 1) {
            return;
        }

        set({ historyIndex: slice.historyIndex + 1 } as Partial<TrajectoryVfsSlice>);
        await slice.refresh();
    },

    refresh: async () => {
        const slice = get() as TrajectoryVfsSlice;

        const connectionId = slice.currentTrajectoryId ?? 'root';
        const path = slice.cwd;

        await runRequest(set, get, () => trajectoryRepository.vfsList(connectionId, path), {
            errorFallback: 'Error loading files',
            loadingKey: 'loading',
            onSuccess: (response: any) => {
                const result = response.data ?? response;
                set({
                    cwd: result.cwd,
                    entries: result.entries,
                    breadcrumbs: result.breadcrumbs,
                    selected: result.selected
                } as Partial<TrajectoryVfsSlice>);
            }
        });
    },

    select: (relPath) => {
        set({ selected: relPath } as Partial<TrajectoryVfsSlice>);
    },

    download: async (relPath) => {
        const slice = get() as TrajectoryVfsSlice;

        const connectionId = slice.currentTrajectoryId ?? 'root';
        const path = relPath;

        const blob = await trajectoryRepository.vfsDownload(connectionId, path);

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');

        const filename = relPath.split('/').pop() || 'file';

        anchor.href = url;
        anchor.download = filename;

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        URL.revokeObjectURL(url);
    },

    setShowHidden: async (showHidden) => {
        set({ showHidden } as Partial<TrajectoryVfsSlice>);
        await (get() as TrajectoryVfsSlice).refresh();
    },

    fetchTrajectories: async () => {
        await runRequest(set, get, () => trajectoryRepository.vfsGetTrajectories(), {
            loadingKey: 'loadingTrajectories',
            errorFallback: 'Error fetching trajectories',
            onSuccess: (trajectories) => {
                set({ trajectories });
            },
            onError: () => {
                set({ trajectories: [] });
            }
        });
    },

    navigateToTrajectory: async (trajectoryId) => {
        set({ currentTrajectoryId: trajectoryId });

        await (get() as TrajectoryVfsSlice).open(trajectoryId);
    }
});
