/**
* Copyright(c) 2025, The Volterra Authors. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files(the "Software"), to deal
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
import { createAsyncAction } from '@/utilities/asyncAction';
import { calculatePaginationState } from '@/utilities/pagination-utils';
import { extractErrorMessage } from '@/utilities/error-extractor';
import type { Trajectory } from '@/types/models';
import { v4 as uuidv4 } from 'uuid';
import type { TrajectoryState, TrajectoryStore } from '@/types/stores/trajectories';
import PreviewCacheService from '@/services/preview-cache-service';
import { clearTrajectoryPreviewCache } from '@/hooks/trajectory/use-trajectory-preview';
import Logger from '@/services/logger';
import trajectoryApi from '@/services/api/trajectory';

const initialState: TrajectoryState = {
    trajectories: [],
    dashboardTrajectories: [],
    listingMeta: {
        page: 1,
        limit: 20,
        total: 0,
        hasMore: false
    },
    trajectory: null,
    isLoading: true,
    isFetchingMore: false,
    isDashboardTrajectoriesLoading: true,
    uploadingFileCount: 0,
    activeUploads: {},
    error: null,
    isMetricsLoading: false,
    trajectoryMetrics: {},
    selectedTrajectories: [],
    isLoadingTrajectories: true,
};

export function dataURLToBlob(dataURL: string): Blob{
    const [header, data] = dataURL.split(',');
    const isBase64 = /;base64/i.test(header);
    const mimeMatch = header.match(/data:([^;]+)/i);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

    if(isBase64){
        const byteString = atob(data);
        const len = byteString.length;
        const u8 = new Uint8Array(len);
        for(let i = 0; i < len; i++) u8[i] = byteString.charCodeAt(i);
        return new Blob([u8], { type: mime });
    }else{
        return new Blob([decodeURIComponent(data)], { type: mime });
    }
}

export function dataURLToObjectURL(dataURL: string): string{
    const blob = dataURLToBlob(dataURL);
    return URL.createObjectURL(blob);
}

const previewCache = new PreviewCacheService();

const useTrajectoryStore = create<TrajectoryStore>()((set, get) => {
    const asyncAction = createAsyncAction(set, get);
    const logger = new Logger('use-trajectory-store');

    const updateTrajectoryInList = (id: string, updates: Partial<Trajectory>) => {
        const currentTrajectories = get().trajectories;
        const currentDashboardTrajectories = get().dashboardTrajectories;
        const currentTrajectory = get().trajectory;
        return {
            trajectories: currentTrajectories.map(t => (t._id === id ? { ...t, ...updates } : t)),
            dashboardTrajectories: currentDashboardTrajectories.map(t =>
                t._id === id ? { ...t, ...updates } : t
            ),
            trajectory:
                currentTrajectory?._id === id ? { ...currentTrajectory, ...updates } : currentTrajectory
        };
  };

    const removeTrajectoryFromList = (id: string) => {
        const currentTrajectories = get().trajectories;
        const currentDashboardTrajectories = get().dashboardTrajectories;
        const currentTrajectory = get().trajectory;

        return {
            trajectories: currentTrajectories.filter(t => t._id !== id),
            dashboardTrajectories: currentDashboardTrajectories.filter(t => t._id !== id),
            trajectory: currentTrajectory?._id === id ? null : currentTrajectory
        };
    };

  return {
      ...initialState,

        getTrajectories: (teamId?: string, opts = {}) => {
            const { page = 1, limit = 20, search = '', append = false } = opts;

            if(append){
                if(get().isFetchingMore) return Promise.resolve();
                set({ isFetchingMore: true });
            }else{
                set({ isLoadingTrajectories: true });
            }

            return asyncAction(
                () =>
                trajectoryApi.getAllPaginated({
                    teamId,
                    populate: 'analysis,createdBy',
                    page,
                    limit,
                    q: search
                }),
                {
                    loadingKey: append ? 'isFetchingMore' : 'isLoadingTrajectories',
                    onSuccess: (response) => {
                        const { data: nextList, listingMeta } = calculatePaginationState({
                            newData: response.data || [],
                            currentData: get().trajectories,
                            page,
                            limit,
                            append,
                            totalFromApi: response.total,
                            previousTotal: get().listingMeta.total
                        });

                        return {
                            trajectories: nextList,
                            listingMeta,
                            error: null,
                            isFetchingMore: false,
                            isLoadingTrajectories: false
                        };
                    },
                    onError: (error) => {
                        const errorMessage = extractErrorMessage(error, 'Failed to load trajectories');
                        return {
                            error: errorMessage,
                            isFetchingMore: false,
                            isLoadingTrajectories: false
                        };
                    }
                }
            );
        },

        getDashboardTrajectories: (teamId?: string, _opts?: { force?: boolean }) => {
            return asyncAction(() => trajectoryApi.getAll({ teamId, populate: 'analysis,createdBy', limit: 5 }), {
                loadingKey: 'isDashboardTrajectoriesLoading',
                onSuccess: (list) => {
                    return {
                        dashboardTrajectories: list,
                        error: null
                    };
                },
                onError: (error) => {
                    const errorMessage = extractErrorMessage(error, 'Failed to load dashboard trajectories');
                    return { error: errorMessage };
                }
            });
        },

        getTrajectoryById: (id: string) => asyncAction(() => trajectoryApi.getOne(id, 'team,analysis'), {
            loadingKey: 'isLoading',
            onSuccess: (trajectory) => ({
                trajectory,
                error: null
            }),

            onError: (error) => {
                const errorMessage = extractErrorMessage(error, 'Failed to load trajectory');
                return { error: errorMessage };
            }
        }),

        createTrajectory: async(
            formData: FormData,
            _teamId?: string,
            onProgress?: (progress: number) => void,
            existingUploadId?: string
        ) => {
            const uploadId = existingUploadId || uuidv4();

            set(state => ({
                activeUploads: {
                    ...state.activeUploads,
                [uploadId]: { id: uploadId, uploadProgress: 0, processingProgress: 0, status: 'uploading' }
                }
            }));

            try{
                const newTrajectory = await trajectoryApi.create(formData, (progress) => {
                set(state => ({
                    activeUploads: {
                        ...state.activeUploads,
                    [uploadId]: {
                        ...state.activeUploads[uploadId],
                        uploadProgress: progress,
                        status: progress === 1 ? 'processing' : 'uploading'
                    }
                    }
                }));
                if(onProgress) onProgress(progress);
                });

                set(state => ({
                trajectories: [newTrajectory, ...state.trajectories],
                dashboardTrajectories: [newTrajectory, ...state.dashboardTrajectories],
                error: null
                }));
            }catch(error: any){
                const errorMessage = extractErrorMessage(error, 'Error uploading trajectory');
                set(state => {
                const { [uploadId]: _, ...remainingUploads } = state.activeUploads;
                return {
                    activeUploads: remainingUploads,
                    error: errorMessage
                };
                });
                throw error;
            }
        },

        dismissUpload: (uploadId: string) => {
            set(state => {
                const { [uploadId]: _, ...remainingUploads } = state.activeUploads;
                return { activeUploads: remainingUploads };
            });
        },

        updateUploadProgress: (uploadId: string, progress: number, type: 'upload' | 'processing') => {
            set(state => {
                const upload = state.activeUploads[uploadId];
                if(!upload) return state;

                return {
                activeUploads: {
                    ...state.activeUploads,
                    [uploadId]: {
                        ...upload,
                    [type === 'upload' ? 'uploadProgress' : 'processingProgress']: progress,
                    status: type === 'upload' && progress < 1 ? 'uploading' : 'processing'
                    }
                }
                };
            });
        },

        updateTrajectoryById: async(id: string, data: Partial<Pick<Trajectory, 'name' | 'isPublic' | 'preview'>>) => {
            const originalState = {
                trajectories: get().trajectories,
                dashboardTrajectories: get().dashboardTrajectories,
                trajectory: get().trajectory
            };

            set(updateTrajectoryInList(id, data));

            try{
                await trajectoryApi.update(id, data);
            }catch(error: any){
                set(originalState);
                const errorMessage = extractErrorMessage(error, 'Failed to update trajectory');
                set({ error: errorMessage });
                throw error;
            }
        },

        deleteSelectedTrajectories: async() => {
            const ids = get().selectedTrajectories;
            if(ids.length === 0) return;

            const originalState = {
                trajectories: get().trajectories,
                dashboardTrajectories: get().dashboardTrajectories,
                trajectory: get().trajectory,
                selectedTrajectories: get().selectedTrajectories
            };

            set(state => ({
                trajectories: state.trajectories.filter(t => !ids.includes(t._id)),
                dashboardTrajectories: state.dashboardTrajectories.filter(t => !ids.includes(t._id)),
                trajectory: state.trajectory && ids.includes(state.trajectory._id) ? null : state.trajectory,
                selectedTrajectories: []
            }));

            try{
                await Promise.all(ids.map((id) => trajectoryApi.delete(id)));
            }catch(e: any){
                set(originalState);
                throw e;
            }
        },

        deleteTrajectoryById: async(id: string, _teamId?: string) => {
            const originalState = {
                trajectories: get().trajectories,
                dashboardTrajectories: get().dashboardTrajectories,
                trajectory: get().trajectory
            };

            set(removeTrajectoryFromList(id));
            clearTrajectoryPreviewCache(id);

            try{
                await trajectoryApi.delete(id);
            }catch(error: any){
                set(originalState);
                set({ error: extractErrorMessage(error, 'Failed to delete trajectory') });
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

        async getFrameAtoms(trajectoryId, timestep, opts) {
            const page = opts?.page ?? 1;
            const pageSize = opts?.pageSize ?? 100000;

            try{
                const payload = await trajectoryApi.getAtoms(trajectoryId, timestep, { page, pageSize });
                return payload || null;
            }catch(e: any){
                const errorMessage = extractErrorMessage(e, 'Error loading frame atoms');
                console.error('Failed to load frame atoms:', errorMessage);
                return null;
            }
        },

        getMetrics: (id: string, opts?: { force?: boolean }) => {
            const force = !!opts?.force;
            const current = get().trajectoryMetrics as any;
            if(current && current?.trajectory?._id === id && !force){
                return Promise.resolve();
            }

            return asyncAction(
                () => trajectoryApi.getMetrics(id),
                {
                    loadingKey: 'isMetricsLoading',
                    onSuccess: (trajectoryMetrics) => ({
                        trajectoryMetrics,
                        error: null
                    }),
                    onError: (error) => ({
                        error: extractErrorMessage(error, 'Failed to load trajectory metrics')
                    })
                }
            );
        },

        setTrajectory: (trajectory: Trajectory | null) => set({ trajectory }),
        clearError: () => set({ error: null }),

        clearCurrentTrajectory: () => {
            set({
                trajectory: null,
                error: null,
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
