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
import { createAsyncAction } from '@/utilities/asyncAction';
import type { Trajectory } from '@/types/models';
import type { ApiResponse } from '@/types/api';
import type { TrajectoryState, TrajectoryStore } from '@/types/stores/trajectories';
import PreviewCacheService from '@/services/preview-cache-service';
import { clearTrajectoryPreviewCache } from '@/hooks/trajectory/use-trajectory-preview';
import Logger from '@/services/logger';

const initialState: TrajectoryState = {
    trajectories: [],
    isAnalysisLoading: true,
    trajectory: null,
    isLoading: true,
    isSavingPreview: false,
    uploadingFileCount: 0,
    error: null,
    isMetricsLoading: false,
    trajectoryMetrics: {},
    structureAnalysis: null,
    selectedTrajectories: [],
    analysisStats: {},
    avgSegmentSeries: [],
    idRateSeries: [],
    isLoadingTrajectories: true,
    dislocationSeries: [],
    cache: {},
    analysisCache: {},
    differencesCache: {},
    atomsCache: {},
    // Raster-related state (kept minimal here; raster logic lives in raster store)
    rasterData: {},
    rasterObjectUrlCache: {} as any,
    rasterCache: {} as any,
    isRasterLoading: false
};

export function dataURLToBlob(dataURL: string): Blob {
  // data:[<mediatype>][;base64],<data>
  const [header, data] = dataURL.split(',');
  const isBase64 = /;base64/i.test(header);
  const mimeMatch = header.match(/data:([^;]+)/i);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

  if (isBase64) {
    const byteString = atob(data);
    const len = byteString.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = byteString.charCodeAt(i);
    return new Blob([u8], { type: mime });
  } else {
    return new Blob([decodeURIComponent(data)], { type: mime });
  }
}

export function dataURLToObjectURL(dataURL: string): string {
  const blob = dataURLToBlob(dataURL);
  return URL.createObjectURL(blob);
}

const previewCache = new PreviewCacheService();

const useTrajectoryStore = create<TrajectoryStore>()((set, get) => {
    const asyncAction = createAsyncAction(set, get);
    const logger = new Logger('use-trajectory-store');

    const updateTrajectoryInList = (id: string, updates: Partial<Trajectory>) => {
        const currentTrajectories = get().trajectories;
        const currentTrajectory = get().trajectory;
        return {
            trajectories: currentTrajectories.map(trajectory =>
                trajectory._id === id ? { ...trajectory, ...updates } : trajectory
            ),
            trajectory: currentTrajectory?._id === id
                ? { ...currentTrajectory, ...updates }
                : currentTrajectory
        };
    };

    const removeTrajectoryFromList = (id: string) => {
        const currentTrajectories = get().trajectories;
        const currentTrajectory = get().trajectory;
        return {
            trajectories: currentTrajectories.filter(t => t._id !== id),
            trajectory: currentTrajectory?._id === id ? null : currentTrajectory
        };
    };

    const keyForTeam = (teamId?: string) => teamId || 'all';

    return {
        ...initialState,
        
    // (Deprecated) metrics helpers were removed; using trajectoryMetrics instead.

        getTrajectories: (teamId?: string, opts?: { force?: boolean }) => {
            const key = keyForTeam(teamId);
            const force = !!opts?.force;
            const cached = get().cache[key];
            if(cached && !force){
                set({ trajectories: cached, isLoading: false, error: null });
                return Promise.resolve();
            }

            const url = teamId ? `/trajectories?teamId=${teamId}&populate=analysis` : '/trajectories';
            
            return asyncAction(() => api.get<ApiResponse<Trajectory[]>>(url), {
                loadingKey: 'isLoadingTrajectories',
                onSuccess: (res) => {
                    const list = res.data.data;
                    const nextCache = { ...get().cache, [key]: list };
                    return {
                        trajectories: list,
                        cache: nextCache,
                        error: null
                    };
                },
                onError: (error) => ({
                    error: error?.response?.data?.message || 'Failed to load trajectories'
                })
            });
        },

        getStructureAnalysis: (teamId: string, opts?: { force?: boolean }) => {
            const force = !!opts?.force;
            const cached = get().analysisCache[teamId];
            if (cached && !force) {
                set({ structureAnalysis: cached, isLoading: false, error: null });
                return Promise.resolve();
            }
            const url = `/structure-analysis/team/${teamId}`;
            return asyncAction(() => api.get<ApiResponse<any>>(url), {
                loadingKey: 'isLoading',
                onSuccess: (res) => {
                    const data = res.data.data;
                    const next = { ...get().analysisCache, [teamId]: data };
                    return {
                        structureAnalysis: data,
                        analysisCache: next,
                        error: null
                    };
                },
                onError: (error) => ({
                    error: error?.response?.data?.message || 'Failed to load trajectories'
                })
            });
        },

        getTrajectoryById: (id: string) =>
            asyncAction(() => api.get<ApiResponse<Trajectory>>(`/trajectories/${id}?populate=team,analysis`), {
                loadingKey: 'isLoading',
                onSuccess: (res) => ({
                    trajectory: res.data.data,
                    error: null
                }),
                onError: (error) => ({
                    error: error?.response?.data?.message || 'Failed to load trajectory'
                })
            }),

        createTrajectory: async (formData: FormData, teamId?: string) => {
            const currentFileCount = get().uploadingFileCount;
            set({ uploadingFileCount: currentFileCount + 1, error: null });
            try {
                const response = await api.post<ApiResponse<Trajectory>>('/trajectories', formData);
                const newTrajectory = response.data.data;
                const key = keyForTeam(teamId);
                const currentList = get().cache[key] || get().trajectories;
                const updated = [newTrajectory, ...currentList];
                set({
                    trajectories: updated,
                    cache: { ...get().cache, [key]: updated },
                    uploadingFileCount: Math.max(0, get().uploadingFileCount - 1),
                    error: null
                });
            } catch (error: any) {
                set({
                    uploadingFileCount: Math.max(0, get().uploadingFileCount - 1),
                    error: error?.response?.data?.message || 'Error uploading trajectory'
                });
                throw error;
            }
        },

        updateTrajectoryById: async (id: string, data: Partial<Pick<Trajectory, 'name' | 'isPublic' | 'preview'>>) => {
            const originalState = {
                trajectories: get().trajectories,
                trajectory: get().trajectory,
                cache: get().cache
            };
            set(updateTrajectoryInList(id, data));
            try {
                await api.patch<ApiResponse<Trajectory>>(`/trajectories/${id}`, data);
                const nextCache: Record<string, Trajectory[]> = {};
                Object.entries(get().cache).forEach(([k, arr]) => {
                    nextCache[k] = arr.map(t => t._id === id ? { ...t, ...data } as Trajectory : t);
                });
                set({ cache: nextCache });
            } catch (error: any) {
                set(originalState);
                set({ error: error?.response?.data?.message || 'Failed to update trajectory' });
                throw error;
            }
        },
        deleteTrajectoryById: async (id: string, teamId?: string) => {
            const originalState = {
                trajectories: get().trajectories,
                trajectory: get().trajectory,
                cache: get().cache
            };
            set(removeTrajectoryFromList(id));
            clearTrajectoryPreviewCache(id);
            const key = keyForTeam(teamId);
            const currentList = get().cache[key] || [];
            const updated = currentList.filter(t => t._id !== id);
            set({ cache: { ...get().cache, [key]: updated } });
            try {
                await api.delete(`/trajectories/${id}`);
            } catch (error: any) {
                set(originalState);
                set({ error: error?.response?.data?.message || 'Failed to delete trajectory' });
                throw error;
            }
        },

        toggleTrajectorySelection: (id: string) => {
            const currentSelected = get().selectedTrajectories;
            const isSelected = currentSelected.includes(id);
            set({
                selectedTrajectories: isSelected
                    ? currentSelected.filter(selectedId => selectedId !== id)
                    : [...currentSelected, id]
            });
        },

        clearSelection: () => set({ selectedTrajectories: [] }),

        deleteSelectedTrajectories: async () => {
            const { selectedTrajectories } = get();
            if (selectedTrajectories.length === 0) return;
            const idsToDelete = [...selectedTrajectories];
            set({ selectedTrajectories: [] });
            const deletePromises = idsToDelete.map(id =>
                get().deleteTrajectoryById(id).catch((error) =>
                    logger.error(`Failed to delete trajectory ${id}:`, error)
                )
            );
            await Promise.allSettled(deletePromises);
        },

        // Raster helpers (stubs to satisfy interface; raster logic lives in raster store)
        async rasterize(id: string){
            try{ await api.post(`/raster/${id}/glb/`); } catch { /* noop */ }
        },
        async getRasterizedFrames(_id: string, _query?: any){
            return null; // Not implemented here
        },
        clearRasterCache(_id?: string){ /* not implemented in this store */ },

        // Fetch atoms positions for a given trajectory/timestep with simple cache.
        async getFrameAtoms(trajectoryId, timestep, opts){
            const force = !!opts?.force;
            const page = opts?.page ?? 1;
            const pageSize = opts?.pageSize ?? 100000;
            const cacheKey = `${trajectoryId}:${timestep}:${page}:${pageSize}`;
            const cached = get().atomsCache?.[cacheKey];
            if(cached && !force){
                return cached;
            }

            try{
                const res = await api.get(`/trajectories/${trajectoryId}/atoms/${timestep}`, {
                    responseType: 'json',
                    params: { page, pageSize }
                });
                const data = res.data?.data || res.data; // controller might send { data } or raw
                if(!data || !Array.isArray(data.positions)){
                    return null;
                }
                const payload = {
                    timestep: Number(data.timestep ?? timestep),
                    natoms: typeof data.natoms === 'number' ? data.natoms : undefined,
                    total: typeof data.total === 'number' ? data.total : undefined,
                    page: typeof data.page === 'number' ? data.page : page,
                    pageSize: typeof data.pageSize === 'number' ? data.pageSize : pageSize,
                    positions: data.positions as number[][],
                    types: Array.isArray(data.types) ? data.types as number[] : undefined
                };
                set((state) => ({
                    atomsCache: { ...(state.atomsCache || {}), [cacheKey]: payload }
                }));
                return payload;
            }catch(e){
                return null;
            }
        },

        saveTrajectoryPreview: async (id: string, dataURL: string) => {
            set({ isSavingPreview: true, error: null });
            try {
                const response = await fetch(dataURL);
                const blob = await response.blob();
                const formData = new FormData();
                formData.append('preview', blob, 'preview.png');
                const result = await api.patch<ApiResponse<Trajectory>>(
                    `/trajectories/${id}`,
                    formData,
                    { headers: { 'Content-Type': 'multipart/form-data' } }
                );
                const updatedTrajectory = result.data.data;
                clearTrajectoryPreviewCache(id);
                const next = updateTrajectoryInList(id, {
                    preview: updatedTrajectory.preview,
                    updatedAt: updatedTrajectory.updatedAt
                });
                set({ ...next, isSavingPreview: false });
                const nextCache: Record<string, Trajectory[]> = {};
                Object.entries(get().cache).forEach(([k, arr]) => {
                    nextCache[k] = arr.map(t =>
                        t._id === id ? { ...t, preview: updatedTrajectory.preview, updatedAt: updatedTrajectory.updatedAt } as Trajectory : t
                    );
                });
                set({ cache: nextCache });
                return { success: true };
            } catch (error: any) {
                set({
                    isSavingPreview: false,
                    error: error?.response?.data?.message || 'Error saving preview'
                });
                return { success: false, error: error?.message || 'Unknown error' };
            }
        },

        getMetrics: (id: string, opts?: { force?: boolean }) => {
  const force = !!opts?.force;
  const current = get().trajectoryMetrics as any;

  // Evita refetch si ya tenemos métricas de esa trayectoria (a menos que force)
  if (current && current?.trajectory?._id === id && !force) {
    return Promise.resolve();
  }

  return asyncAction(
    () => api.get<ApiResponse<any>>(`/trajectories/metrics/${id}`),
    {
      loadingKey: 'isMetricsLoading',
      onSuccess: (res) => ({
        trajectoryMetrics: res.data.data,
        error: null
      }),
      onError: (error) => ({
        error: error?.response?.data?.message || 'Failed to load trajectory metrics'
      })
    }
  );
},


        getTrajectoryPreviewUrl: (id: string) => {
            const trajectory = get().trajectories.find(t => t._id === id)
                || (get().trajectory?._id === id ? get().trajectory : null);
            return trajectory?.preview ? `/trajectories/${id}/preview` : null;
        },

        loadAuthenticatedPreview: (id: string) => previewCache.loadPreview(id),
        isPreviewLoading: (id: string) => previewCache.isLoading(id),
        clearPreviewCache: (id?: string) => previewCache.clear(id),

        setTrajectory: (trajectory: Trajectory | null) => set({ trajectory }),
        clearError: () => set({ error: null }),

        clearCurrentTrajectory: () => {
            set({
                trajectory: null,
                error: null,
                analysisStats: [],
                dislocationSeries: [],
                idRateSeries: [],
                avgSegmentSeries: [],
                selectedTrajectories: []
            });
        },

        reset: () => {
            previewCache.clear();
            set(initialState);
        }
    };
});

export default useTrajectoryStore;