import sshApi from '@/services/api/ssh/ssh';
import { runRequest } from '../../helpers';
import type { SliceCreator } from '../../helpers/create-slice';

type EntryType = 'file' | 'dir';

export interface SSHFileEntry {
    type: EntryType;
    name: string;
    relPath: string;
    size?: number;
    mtime?: string;
}

interface HistoryItem {
    cwd: string;
    connectionId: string;
}

interface BreadcrumbItem {
    name: string;
    relPath: string;
}

export interface SSHExplorerState {
    connectionId: string | null;
    cwd: string;

    entries: SSHFileEntry[];
    breadcrumbs: BreadcrumbItem[];

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

const ROOT_BREADCRUMB: BreadcrumbItem = { name: 'root', relPath: '.' };

const buildBreadcrumbs = (cwd: string): BreadcrumbItem[] => {
    const parts = cwd.split('/').filter(Boolean);

    const breadcrumbs: BreadcrumbItem[] = [ROOT_BREADCRUMB];
    let accumulatedPath = '.';

    for (const part of parts) {
        accumulatedPath = accumulatedPath === '.' ? part : `${accumulatedPath}/${part}`;
        breadcrumbs.push({ name: part, relPath: accumulatedPath });
    }

    return breadcrumbs;
};

const joinPath = (cwd: string, name: string): string => {
    if (!cwd || cwd === '.') return name;
    return `${cwd}/${name}`;
};

const getParentPath = (cwd: string): string => {
    if (!cwd || cwd === '.') return '.';

    const parent = cwd.split('/').slice(0, -1).join('/');
    return parent || '.';
};

const cutHistoryToIndex = (history: HistoryItem[], historyIndex: number): HistoryItem[] => {
    return history.slice(0, historyIndex + 1);
};

export const initialState: SSHExplorerState = {
    connectionId: null,
    cwd: '.',

    entries: [],
    breadcrumbs: [ROOT_BREADCRUMB],

    selected: null,

    loading: true,
    importing: false,
    error: null,

    history: [],
    historyIndex: -1
};

export const createSSHExplorerSlice: SliceCreator<SSHExplorerSlice> = (set, get) => {
    const requireConnectionId = (state: SSHExplorerSlice): string | null => {
        if (state.connectionId) return state.connectionId;
        set({ error: 'No SSH connection selected' } as Partial<SSHExplorerSlice>);
        return null;
    };

    const listDirectory = async (connectionId: string, path: string) => {
        return sshApi.fileExplorer.list({ connectionId, path });
    };

    const applyDirectoryListing = (data: { cwd: string; entries: SSHFileEntry[] }) => {
        set({
            cwd: data.cwd,
            entries: data.entries,
            breadcrumbs: buildBreadcrumbs(data.cwd),
            selected: null
        } as Partial<SSHExplorerSlice>);
    };

    const openAndPushHistory = async (path: string) => {
        const state = get() as SSHExplorerSlice;
        const connectionId = requireConnectionId(state);
        if (!connectionId) return;

        await runRequest(set, get, () => listDirectory(connectionId, path), {
            errorFallback: 'Error loading files',
            loadingKey: 'loading',
            onSuccess: (data) => {
                set((current: SSHExplorerSlice) => {
                    const trimmedHistory = cutHistoryToIndex(current.history, current.historyIndex);

                    const nextHistory: HistoryItem[] = [
                        ...trimmedHistory,
                        { cwd: data.cwd, connectionId: current.connectionId! }
                    ];

                    return {
                        cwd: data.cwd,
                        entries: data.entries,
                        breadcrumbs: buildBreadcrumbs(data.cwd),
                        selected: null,
                        history: nextHistory,
                        historyIndex: nextHistory.length - 1
                    };
                });
            }
        });
    };

    const openWithoutTouchingHistory = async (target: HistoryItem) => {
        await runRequest(set, get, () => listDirectory(target.connectionId, target.cwd), {
            errorFallback: 'Error loading files',
            loadingKey: 'loading',
            onSuccess: (data) => applyDirectoryListing(data)
        });
    };

    return {
        ...initialState,

        setConnection: (connectionId) => {
            set({ ...initialState, connectionId } as SSHExplorerSlice);
        },

        open: async (relPath = '.') => {
            await openAndPushHistory(relPath);
        },

        enter: async (name) => {
            const state = get() as SSHExplorerSlice;
            const nextPath = joinPath(state.cwd, name);
            await openAndPushHistory(nextPath);
        },

        up: async () => {
            const state = get() as SSHExplorerSlice;
            const parentPath = getParentPath(state.cwd);

            if (parentPath === state.cwd) return;
            await openAndPushHistory(parentPath);
        },

        back: async () => {
            const state = get() as SSHExplorerSlice;

            if (!state.connectionId) return;
            if (state.historyIndex <= 0) return;

            const nextIndex = state.historyIndex - 1;
            const target = state.history[nextIndex];

            set({ historyIndex: nextIndex } as Partial<SSHExplorerSlice>);
            await openWithoutTouchingHistory(target);
        },

        forward: async () => {
            const state = get() as SSHExplorerSlice;

            if (state.historyIndex >= state.history.length - 1) return;

            const nextIndex = state.historyIndex + 1;
            const target = state.history[nextIndex];

            set({ historyIndex: nextIndex } as Partial<SSHExplorerSlice>);
            await openWithoutTouchingHistory(target);
        },

        refresh: async () => {
            const state = get() as SSHExplorerSlice;
            if (!state.connectionId) return;

            await runRequest(set, get, () => listDirectory(state.connectionId!, state.cwd), {
                errorFallback: 'Error loading files',
                loadingKey: 'loading',
                onSuccess: (data) => applyDirectoryListing(data)
            });
        },

        select: (relPath) => {
            set({ selected: relPath } as Partial<SSHExplorerSlice>);
        },

        importTrajectory: async (teamId) => {
            const state = get() as SSHExplorerSlice;

            if (!state.connectionId || !state.selected) {
                throw new Error('No connection or file selected');
            }

            const connectionId = state.connectionId;
            const remotePath = state.selected;

            return await runRequest(
                set,
                get,
                () => sshApi.fileExplorer.import({ connectionId, remotePath, teamId }),
                {
                    loadingKey: 'importing',
                    errorFallback: 'Error importing trajectory',
                    rethrow: true
                }
            );
        },

        reset: () => {
            set(initialState);
        }
    };
};
