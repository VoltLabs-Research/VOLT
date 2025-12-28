import sshApi from '@/services/api/ssh/ssh';
import { runRequest } from '../../helpers';
import type { SliceCreator } from '../../helpers/create-slice';

type EntryType = 'file' | 'dir';

export interface SSHFileEntry { type: EntryType; name: string; relPath: string; size?: number; mtime?: string }
interface HistoryItem { cwd: string; connectionId: string }

export interface SSHExplorerState {
    connectionId: string | null;
    cwd: string;
    entries: SSHFileEntry[];
    breadcrumbs: Array<{ name: string; relPath: string }>;
    selected: string | null;
    loading: boolean;
    importing: boolean;
    error: string | null;
    history: HistoryItem[];
    historyIndex: number;
}

export interface SSHExplorerActions {
    setConnection: (connectionId: string) => void;
    open: (relPath?: string) => Promise<void>;
    enter: (name: string) => Promise<void>;
    up: () => Promise<void>;
    back: () => Promise<void>;
    forward: () => Promise<void>;
    refresh: () => Promise<void>;
    select: (relPath: string | null) => void;
    importTrajectory: (teamId: string, name?: string) => Promise<any>;
    reset: () => void;
}

export type SSHExplorerSlice = SSHExplorerState & SSHExplorerActions;

const buildBreadcrumbs = (relPath: string) => {
    const parts = relPath.split('/').filter(Boolean);
    const crumbs = [{ name: 'root', relPath: '.' }];
    let acc = '.';
    for (const part of parts) { acc = acc === '.' ? part : `${acc}/${part}`; crumbs.push({ name: part, relPath: acc }); }
    return crumbs;
};

export const initialState: SSHExplorerState = {
    connectionId: null, cwd: '.', entries: [], breadcrumbs: [{ name: 'root', relPath: '.' }],
    selected: null, loading: false, importing: false, error: null, history: [], historyIndex: -1
};

export const createSSHExplorerSlice: SliceCreator<SSHExplorerSlice> = (set, get) => ({
    ...initialState,

    setConnection: (connectionId) => set({ ...initialState, connectionId } as SSHExplorerSlice),

    open: async (relPath = '.') => {
        const state = get() as SSHExplorerSlice;
        if (!state.connectionId) { set({ error: 'No SSH connection selected' } as Partial<SSHExplorerSlice>); return; }

        await runRequest(set, get, () => sshApi.fileExplorer.list({ connectionId: state.connectionId!, path: relPath }), {
            errorFallback: 'Error loading files',
            onSuccess: (data) => set((s: SSHExplorerSlice) => {
                const newHist = s.history.slice(0, s.historyIndex + 1);
                newHist.push({ cwd: data.cwd, connectionId: s.connectionId! });
                return { cwd: data.cwd, entries: data.entries, breadcrumbs: buildBreadcrumbs(data.cwd), selected: null, history: newHist, historyIndex: newHist.length - 1 };
            })
        });
    },

    enter: async (name) => { const s = get() as SSHExplorerSlice; await s.open(s.cwd === '.' ? name : `${s.cwd}/${name}`); },
    up: async () => { const s = get() as SSHExplorerSlice; if (s.cwd !== '.') await s.open(s.cwd.split('/').slice(0, -1).join('/') || '.'); },

    back: async () => {
        const s = get() as SSHExplorerSlice;
        if (s.historyIndex <= 0 || !s.connectionId) return;
        const target = s.history[s.historyIndex - 1];
        set({ historyIndex: s.historyIndex - 1 } as Partial<SSHExplorerSlice>);
        await runRequest(set, get, () => sshApi.fileExplorer.list({ connectionId: target.connectionId, path: target.cwd }), {
            errorFallback: 'Error loading files',
            onSuccess: (data) => set({ cwd: data.cwd, entries: data.entries, breadcrumbs: buildBreadcrumbs(data.cwd), selected: null } as Partial<SSHExplorerSlice>)
        });
    },

    forward: async () => {
        const s = get() as SSHExplorerSlice;
        if (s.historyIndex >= s.history.length - 1) return;
        const target = s.history[s.historyIndex + 1];
        set({ historyIndex: s.historyIndex + 1 } as Partial<SSHExplorerSlice>);
        await runRequest(set, get, () => sshApi.fileExplorer.list({ connectionId: target.connectionId, path: target.cwd }), {
            errorFallback: 'Error loading files',
            onSuccess: (data) => set({ cwd: data.cwd, entries: data.entries, breadcrumbs: buildBreadcrumbs(data.cwd), selected: null } as Partial<SSHExplorerSlice>)
        });
    },

    refresh: async () => {
        const s = get() as SSHExplorerSlice;
        if (!s.connectionId) return;
        await runRequest(set, get, () => sshApi.fileExplorer.list({ connectionId: s.connectionId!, path: s.cwd }), {
            errorFallback: 'Error loading files',
            onSuccess: (data) => set({ cwd: data.cwd, entries: data.entries, breadcrumbs: buildBreadcrumbs(data.cwd), selected: null } as Partial<SSHExplorerSlice>)
        });
    },

    select: (relPath) => set({ selected: relPath } as Partial<SSHExplorerSlice>),

    importTrajectory: async (teamId) => {
        const s = get() as SSHExplorerSlice;
        if (!s.connectionId || !s.selected) throw new Error('No connection or file selected');
        return await runRequest(set, get, () => sshApi.fileExplorer.import({ connectionId: s.connectionId!, remotePath: s.selected!, teamId }), {
            loadingKey: 'importing', errorFallback: 'Error importing trajectory', rethrow: true
        });
    },

    reset: () => set(initialState as SSHExplorerSlice)
});
