/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { create } from 'zustand';
import sshApi from '@/services/api/ssh';

type EntryType = 'file' | 'dir';

export interface SSHFileEntry {
    type: EntryType;
    name: string;
    relPath: string;
    size?: number;
    mtime?: string;
}

interface SSHFileListResponse {
    cwd: string;
    entries: SSHFileEntry[];
}

interface HistoryItem {
    cwd: string;
    connectionId: string;
}

interface SSHFileExplorerState {
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

    _fetchFileList: (connectionId: string, path: string) => Promise<SSHFileListResponse>;
    _gotoWithoutPush: (connectionId: string, cwd: string) => Promise<void>;
}

const buildBreadcrumbs = (relPath: string) => {
    const parts = relPath.split('/').filter(Boolean);
    const crumbs = [{ name: 'root', relPath: '.' }];
    let acc = '.';
    for (const part of parts) {
        acc = acc === '.' ? part : `${acc}/${part}`;
        crumbs.push({ name: part, relPath: acc });
    }
    return crumbs;
};

const useSSHFileExplorer = create<SSHFileExplorerState>((set, get) => ({
    connectionId: null,
    cwd: '.',
    entries: [],
    breadcrumbs: [{ name: 'root', relPath: '.' }],
    selected: null,
    loading: false,
    importing: false,
    error: null,
    history: [],
    historyIndex: -1,

    async _fetchFileList(connectionId: string, path: string) {
        const data = await sshApi.fileExplorer.list({ connectionId, path });
        return { cwd: data.currentPath, entries: data.files.map(f => ({ type: f.type === 'directory' ? 'dir' : 'file', name: f.name, relPath: f.path, size: f.size })) };
    },

    setConnection(connectionId: string) {
        set({
            connectionId,
            cwd: '.',
            entries: [],
            breadcrumbs: [{ name: 'root', relPath: '.' }],
            selected: null,
            history: [],
            historyIndex: -1,
            error: null
        });
    },

    async open(relPath: string = '.') {
        const { connectionId } = get();
        if (!connectionId) {
            set({ error: 'No SSH connection selected' });
            return;
        }

        set({ loading: true, error: null });
        try {
            const data = await get()._fetchFileList(connectionId, relPath);
            set((state) => {
                const newHist = state.history.slice(0, state.historyIndex + 1);
                newHist.push({ cwd: data.cwd, connectionId });

                return {
                    cwd: data.cwd,
                    entries: data.entries,
                    breadcrumbs: buildBreadcrumbs(data.cwd),
                    selected: null,
                    loading: false,
                    error: null,
                    history: newHist,
                    historyIndex: newHist.length - 1
                };
            });
        } catch (e: any) {
            const errorMessage = e?.response?.data?.data?.error || e?.message || 'Error loading files';
            set({ loading: false, error: errorMessage });
        }
    },

    async enter(name: string) {
        const { cwd } = get();
        const next = cwd === '.' ? name : `${cwd}/${name}`;
        await get().open(next);
    },

    async up() {
        const { cwd } = get();
        if (cwd === '.') return;
        const parent = cwd.split('/').slice(0, -1).join('/') || '.';
        await get().open(parent);
    },

    async back() {
        const { historyIndex, history } = get();
        if (historyIndex <= 0) return;
        const nextIndex = historyIndex - 1;
        const target = history[nextIndex];
        set({ historyIndex: nextIndex });
        await get()._gotoWithoutPush(target.connectionId, target.cwd);
    },

    async forward() {
        const { historyIndex, history } = get();
        if (historyIndex >= history.length - 1) return;
        const nextIndex = historyIndex + 1;
        const target = history[nextIndex];
        set({ historyIndex: nextIndex });
        await get()._gotoWithoutPush(target.connectionId, target.cwd);
    },

    async refresh() {
        const { cwd, connectionId } = get();
        if (!connectionId) return;
        await get()._gotoWithoutPush(connectionId, cwd);
    },

    select(relPath: string | null) {
        set({ selected: relPath });
    },

    async importTrajectory(teamId: string, name?: string) {
        const { connectionId, selected } = get();
        if (!connectionId || !selected) {
            throw new Error('No connection or file selected');
        }

        set({ importing: true, error: null });
        try {
            const data = await sshApi.fileExplorer.import({
                connectionId,
                remotePath: selected
            });
            set({ importing: false });
            return data;
        } catch (e: any) {
            const errorMessage = e?.response?.data?.data?.error || e?.message || 'Error importing trajectory';
            set({ importing: false, error: errorMessage });
            throw new Error(errorMessage);
        }
    },

    reset() {
        set({
            connectionId: null,
            cwd: '.',
            entries: [],
            breadcrumbs: [{ name: 'root', relPath: '.' }],
            selected: null,
            loading: false,
            importing: false,
            error: null,
            history: [],
            historyIndex: -1
        });
    },

    async _gotoWithoutPush(connectionId: string, cwd: string) {
        set({ loading: true, error: null });
        try {
            const data = await get()._fetchFileList(connectionId, cwd);
            set({
                cwd: data.cwd,
                entries: data.entries,
                breadcrumbs: buildBreadcrumbs(data.cwd),
                selected: null,
                loading: false,
                error: null
            });
        } catch (e: any) {
            const errorMessage = e?.response?.data?.data?.error || e?.message || 'Error loading files';
            set({ loading: false, error: errorMessage });
        }
    }
}));

export default useSSHFileExplorer;
