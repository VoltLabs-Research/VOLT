/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
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
**/

import { create } from 'zustand';
import { api } from '@/services/api';

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

interface FsListResponse{
    trajectory: { id: string; name: string };
    cwd: string;
    selected: string | null;
    breadcrumbs: Array<{ name: string; relPath: string }>;
    entries: FsEntry[];
}

interface HistoryItem{ cwd: string }

interface FileExplorerState{
    trajectoryId: string | null;
    cwd: string;
    entries: FsEntry[];
    breadcrumbs: Array<{ name: string; relPath: string }>;
    selected: string | null;
    loading: boolean;
    error: string | null;
    showHidden: boolean;
    history: HistoryItem[];
    historyIndex: number;

    init: (trajectoryId: string) => Promise<void>;
    open: (relPath?: string) => Promise<void>;
    enter: (name: string) => Promise<void>;
    up: () => Promise<void>;
    back: () => Promise<void>;
    forward: () => Promise<void>;
    refresh: () => Promise<void>;
    select: (relPath: string | null) => void;
    download: (relPath: string) => Promise<void>;
    setShowHidden: (v: boolean) => Promise<void>;

    _downloadFsFile: (trajectoryId: string, relPath: string) => Promise<any>;
    _fetchFsList: (trajectoryId: string, path: string, showHidden: boolean) => Promise<any>;
    _gotoWithoutPush: (cwd: string) => Promise<void>;
}

const useTrajectoryFS = create<FileExplorerState>((set, get) => ({
    trajectoryId: null,
    cwd: '',
    entries: [],
    breadcrumbs: [{ name: 'root', relPath: '' }],
    selected: null,
    loading: false,
    error: null,
    showHidden: false,

    history: [{ cwd: '' }],
    historyIndex: 0,
    
    async _fetchFsList(trajectoryId: string, path = '', showHidden = false){
        const res = await api<{ status: 'success', data: FsListResponse }>(`/trajectory-fs/${trajectoryId}/`, {
            params: { path, hidden: showHidden }
        });
        return res.data.data;
    },

    async _downloadFsFile(trajectoryId: string, relPath: string){
        const res = await api.get(`/trajectory-fs/${trajectoryId}/download`, {
            params: { path: relPath },
            responseType: 'blob'
        });
        return res.data.data;
    },

    async init(trajectoryId: string){
        set({
            trajectoryId,
            cwd: '',
            entries: [],
            breadcrumbs: [{ name: 'root', relPath: '' }],
            selected: null,
            history: [{ cwd: '' }],
            historyIndex: 0,
            error: null
        });
        await get().open('');
    },

    async open(relPath: string = ''){
        const { trajectoryId, showHidden } = get();
        if(!trajectoryId) return;
        set({ loading: true, error: null });
        try{
            const data = await get()._fetchFsList(trajectoryId, relPath, showHidden);
            set((state) => {
                const newHist = state.history.slice(0, state.historyIndex + 1);
                newHist.push({ cwd: data.cwd });
                
                return {
                    cwd: data.cwd,
                    entries: data.entries,
                    breadcrumbs: data.breadcrumbs,
                    selected: data.selected,
                    loading: false,
                    error: null,
                    history: newHist,
                    historyIndex: newHist.length - 1
                };
            });
        }catch(e: any){
            set({ loading: false, error: e?.response?.data?.data?.error || e?.message || 'Error loading files' });
        }
    },

    async enter(name: string){
        const { cwd } = get();
        const next = cwd ? `${cwd}/${name}` : name;
        await get().open(next);
    },

    async up(){
        const { cwd } = get();
        if(!cwd) return;
        const parent = cwd.split('/').slice(0, -1).join('/');
        await get().open(parent); 
    },

    async back(){
        const { historyIndex, history } = get();
        if(historyIndex <= 0) return;
        const nextIndex = historyIndex - 1;
        const target = history[nextIndex].cwd;
        set({ historyIndex: nextIndex });
        await get()._gotoWithoutPush(target);   
    },

    async forward(){
        const { historyIndex, history } = get();
        if(historyIndex >= history.length - 1) return;
        const nextIndex = historyIndex + 1;
        const target = history[nextIndex].cwd;
        set({ historyIndex: nextIndex });
        await get()._gotoWithoutPush(target);
    },

    async refresh(){
        const { cwd } = get();
        await get()._gotoWithoutPush(cwd);
    },

    select(relPath: string | null){
        set({ selected: relPath });
    },

    async download(relPath: string){
        const { trajectoryId } = get();
        if(!trajectoryId) return;

        const blob = await get()._downloadFsFile(trajectoryId, relPath);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const name = relPath.split('/').pop() || 'file';
        
        a.href = url;
        a.download = name;
        document.body.appendChild(a);

        a.click();
        a.remove();

        URL.revokeObjectURL(url);
    },

    async setShowHidden(v: boolean){
        set({ showHidden: v });
        await get().refresh();
    },

    async _gotoWithoutPush(cwd: string){
        const { trajectoryId, showHidden } = get();
        if(!trajectoryId) return;
        set({ loading: true, error: null });
        try{
            const data = await get()._fetchFsList(trajectoryId, cwd, showHidden);
            set({
                cwd: data.cwd,
                entries: data.entries,
                breadcrumbs: data.breadcrumbs,
                selected: data.selected,
                loading: false,
                error: null
            })
        }catch(e: any){
            set({ loading: false, error: e?.response?.data?.data?.error || e?.message || 'Error loading files' });
        }
    }
}));

export default useTrajectoryFS;