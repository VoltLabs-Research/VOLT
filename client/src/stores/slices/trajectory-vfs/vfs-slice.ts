import trajectoryApi, { type TrajectoryInfo } from '@/services/api/trajectory/trajectory';
import { runRequest } from '../../helpers';
import type { SliceCreator } from '../../helpers/create-slice';

type EntryType = 'file' | 'dir';

export interface FsEntry { type: EntryType; name: string; relPath: string; size?: number; mtime?: string; ext?: string | null; mime?: string | false }
interface HistoryItem { cwd: string }

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
    trajectories: TrajectoryInfo[];
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
    cwd: '', entries: [], breadcrumbs: [{ name: 'root', relPath: '' }], selected: null,
    loading: false, error: null, showHidden: false, trajectories: [], loadingTrajectories: false,
    currentTrajectoryId: null, history: [{ cwd: '' }], historyIndex: 0
};

export const createTrajectoryVfsSlice: SliceCreator<TrajectoryVfsSlice> = (set, get) => ({
    ...initialState,

    init: async () => { set({ ...initialState } as TrajectoryVfsSlice); const s = get() as TrajectoryVfsSlice; await s.fetchTrajectories(); await s.open(''); },

    open: async (relPath = '') => {
        const s = get() as TrajectoryVfsSlice;
        await runRequest(set, get, () => trajectoryApi.vfs.list({ connectionId: s.currentTrajectoryId || 'root', path: relPath }), {
            errorFallback: 'Error loading files',
            loadingKey: 'loading',
            onSuccess: (data) => set((st: TrajectoryVfsSlice) => {
                const newHist = st.history.slice(0, st.historyIndex + 1);
                newHist.push({ cwd: data.cwd });
                return { cwd: data.cwd, entries: data.entries, breadcrumbs: data.breadcrumbs, selected: data.selected, history: newHist, historyIndex: newHist.length - 1 };
            })
        });
    },

    enter: async (name) => { const s = get() as TrajectoryVfsSlice; await s.open(s.cwd ? `${s.cwd}/${name}` : name); },
    up: async () => { const s = get() as TrajectoryVfsSlice; if (s.cwd) await s.open(s.cwd.split('/').slice(0, -1).join('/')); },
    back: async () => { const s = get() as TrajectoryVfsSlice; if (s.historyIndex <= 0) return; set({ historyIndex: s.historyIndex - 1 } as Partial<TrajectoryVfsSlice>); await s.refresh(); },
    forward: async () => { const s = get() as TrajectoryVfsSlice; if (s.historyIndex >= s.history.length - 1) return; set({ historyIndex: s.historyIndex + 1 } as Partial<TrajectoryVfsSlice>); await s.refresh(); },

    refresh: async () => {
        const s = get() as TrajectoryVfsSlice;
        await runRequest(set, get, () => trajectoryApi.vfs.list({ connectionId: s.currentTrajectoryId || 'root', path: s.cwd }), {
            errorFallback: 'Error loading files',
            loadingKey: 'loading',
            onSuccess: (data) => set({ cwd: data.cwd, entries: data.entries, breadcrumbs: data.breadcrumbs, selected: data.selected } as Partial<TrajectoryVfsSlice>)
        });
    },

    select: (relPath) => set({ selected: relPath } as Partial<TrajectoryVfsSlice>),

    download: async (relPath) => {
        const s = get() as TrajectoryVfsSlice;
        const blob = await trajectoryApi.vfs.download({ connectionId: s.currentTrajectoryId || 'root', path: relPath });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = relPath.split('/').pop() || 'file';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    },

    setShowHidden: async (v) => { set({ showHidden: v } as Partial<TrajectoryVfsSlice>); await (get() as TrajectoryVfsSlice).refresh(); },

    fetchTrajectories: async () => {
        await runRequest(set, get, () => trajectoryApi.vfs.getTrajectories(), {
            loadingKey: 'loadingTrajectories', errorFallback: 'Error fetching trajectories',
            onSuccess: (trajectories) => set({ trajectories } as Partial<TrajectoryVfsSlice>),
            onError: () => set({ trajectories: [] } as Partial<TrajectoryVfsSlice>)
        });
    },

    navigateToTrajectory: async (trajectoryId) => { set({ currentTrajectoryId: trajectoryId } as Partial<TrajectoryVfsSlice>); await (get() as TrajectoryVfsSlice).open(trajectoryId); }
});
