import { runRequest } from '@/shared/presentation/stores/helpers';
import type { SliceCreator } from '@/shared/presentation/stores/helpers';
import type { SSHFileEntry } from '../../domain/entities';
import { BreadcrumbService, type BreadcrumbItem } from '../../domain/services/BreadcrumbService';
import { sshRepository } from '../../infrastructure/repositories/SSHRepository';

export interface HistoryItem {
    cwd: string;
    connectionId: string;
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
    openExplorer: (relPath?: string) => Promise<void>;
    enterExplorer: (name: string) => Promise<void>;
    upExplorer: () => Promise<void>;
    backExplorer: () => Promise<void>;
    forwardExplorer: () => Promise<void>;
    refreshExplorer: () => Promise<void>;
    selectExplorer: (relPath: string | null) => void;
    importTrajectoryFromSSH: (teamId: string, name?: string) => Promise<any>;
    resetExplorer: () => void;
}

export type SSHExplorerSlice = SSHExplorerState & SSHExplorerActions;

const breadcrumbService = new BreadcrumbService();
const ROOT_BREADCRUMB: BreadcrumbItem = breadcrumbService.getRoot();

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

export const createSSHExplorerSlice: SliceCreator<SSHExplorerSlice> = (set, get) => ({
    ...initialState,

    setConnection: (connectionId) => {
        set({ ...initialState, connectionId });
    },

    openExplorer: async (relPath = '.') => {
        const { connectionId } = get();
        if (!connectionId) return;

        await runRequest(set, get, () => sshRepository.listFiles({ connectionId, path: relPath }), {
            errorFallback: 'Error loading files',
            loadingKey: 'loading',
            onSuccess: (data) => {
                const nextHistory = [...get().history.slice(0, get().historyIndex + 1), { cwd: data.cwd, connectionId }];
                set({
                    cwd: data.cwd,
                    entries: data.entries,
                    breadcrumbs: breadcrumbService.buildBreadcrumbs(data.cwd),
                    selected: null,
                    history: nextHistory,
                    historyIndex: nextHistory.length - 1
                });
            }
        });
    },

    enterExplorer: async (name) => {
        const { cwd } = get();
        const nextPath = cwd === '.' ? name : `${cwd}/${name}`;
        await get().openExplorer(nextPath);
    },

    upExplorer: async () => {
        const { cwd } = get();
        if (cwd === '.') return;
        const parent = cwd.split('/').slice(0, -1).join('/') || '.';
        await get().openExplorer(parent);
    },

    backExplorer: async () => {
        const { history, historyIndex } = get();
        if (historyIndex <= 0) return;
        const target = history[historyIndex - 1];
        await runRequest(set, get, () => sshRepository.listFiles({ connectionId: target.connectionId, path: target.cwd }), {
            loadingKey: 'loading',
            onSuccess: (data) => set({
                cwd: data.cwd,
                entries: data.entries,
                breadcrumbs: breadcrumbService.buildBreadcrumbs(data.cwd),
                selected: null,
                historyIndex: historyIndex - 1
            })
        });
    },

    forwardExplorer: async () => {
        const { history, historyIndex } = get();
        if (historyIndex >= history.length - 1) return;
        const target = history[historyIndex + 1];
        await runRequest(set, get, () => sshRepository.listFiles({ connectionId: target.connectionId, path: target.cwd }), {
            loadingKey: 'loading',
            onSuccess: (data) => set({
                cwd: data.cwd,
                entries: data.entries,
                breadcrumbs: breadcrumbService.buildBreadcrumbs(data.cwd),
                selected: null,
                historyIndex: historyIndex + 1
            })
        });
    },

    refreshExplorer: async () => {
        const { connectionId, cwd } = get();
        if (!connectionId) return;
        await runRequest(set, get, () => sshRepository.listFiles({ connectionId, path: cwd }), {
            loadingKey: 'loading',
            onSuccess: (data) => set({
                entries: data.entries,
                breadcrumbs: breadcrumbService.buildBreadcrumbs(data.cwd)
            })
        });
    },

    selectExplorer: (relPath) => set({ selected: relPath }),

    importTrajectoryFromSSH: async (teamId) => {
        const { connectionId, selected } = get();
        if (!connectionId || !selected) throw new Error('No connection or file selected');
        return await runRequest(set, get, () => sshRepository.importFile({ connectionId, remotePath: selected, teamId }), {
            loadingKey: 'importing',
            errorFallback: 'Error importing trajectory',
            rethrow: true
        });
    },

    resetExplorer: () => set(initialState)
});
