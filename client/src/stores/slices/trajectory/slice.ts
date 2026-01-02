import { calculatePaginationState } from '@/utilities/api/pagination-utils';
import type { Trajectory } from '@/types/models';
import { v4 as uuidv4 } from 'uuid';
import type { TrajectoryState, TrajectoryStore } from '@/types/stores/trajectories';
import PreviewCacheService from '@/services/common/preview-cache-service';
import { clearTrajectoryPreviewCache } from '@/hooks/trajectory/use-trajectory-preview';
import trajectoryApi from '@/services/api/trajectory/trajectory';
import { runRequest } from '../../helpers';
import { extractErrorMessage } from '@/utilities/api/error-extractor';
import type { SliceCreator } from '../../helpers/create-slice';

const trajectoryPreviewCache = new PreviewCacheService();

function removeUploadProgress(
    uploadId: string,
    currentUploads: Record<string, number>
): Record<string, number> {
    const { [uploadId]: _removed, ...remainingUploads } = currentUploads;
    return remainingUploads;
}

function patchTrajectoryInStore(
    currentStore: TrajectoryStore,
    trajectoryId: string,
    patch: Partial<Trajectory>
): Pick<TrajectoryStore, 'trajectories' | 'trajectory'> {
    const updatedTrajectories = currentStore.trajectories.map((trajectory) => {
        if (trajectory._id !== trajectoryId) {
            return trajectory;
        }

        return { ...trajectory, ...patch };
    });

    const currentTrajectory = currentStore.trajectory;
    const updatedCurrentTrajectory =
        currentTrajectory && currentTrajectory._id === trajectoryId
            ? ({ ...currentTrajectory, ...patch } as Trajectory)
            : currentTrajectory;

    return {
        trajectories: updatedTrajectories,
        trajectory: updatedCurrentTrajectory
    };
}

function removeTrajectoriesFromStore(
    currentStore: TrajectoryStore,
    trajectoryIdsToRemove: string[]
): Pick<TrajectoryStore, 'trajectories' | 'trajectory' | 'selectedTrajectories'> {
    const remainingTrajectories = currentStore.trajectories.filter(
        (trajectory) => !trajectoryIdsToRemove.includes(trajectory._id)
    );

    const currentTrajectory = currentStore.trajectory;
    const shouldClearCurrentTrajectory =
        !!currentTrajectory && trajectoryIdsToRemove.includes(currentTrajectory._id);

    return {
        trajectories: remainingTrajectories,
        trajectory: shouldClearCurrentTrajectory ? null : currentTrajectory,
        selectedTrajectories: []
    };
}

function toggleIdInSelection(selectedIds: string[], idToToggle: string): string[] {
    const isSelected = selectedIds.includes(idToToggle);

    if (isSelected) {
        return selectedIds.filter((selectedId) => selectedId !== idToToggle);
    }

    return [...selectedIds, idToToggle];
}

export const initialState: TrajectoryState = {
    trajectories: [],
    listingMeta: {
        page: 1,
        limit: 20,
        total: 0,
        hasMore: false
    },
    trajectory: null,
    isLoading: false,
    isFetchingMore: false,
    activeUploads: {},
    error: null,
    isMetricsLoading: false,
    trajectoryMetrics: {},
    selectedTrajectories: [],
    isLoadingTrajectories: true
};

export const createTrajectorySlice: SliceCreator<TrajectoryStore> = (set, get) => ({
    ...initialState,

    getTrajectories: async (_teamId, options = {}) => {
        const {
            page = 1,
            limit = 20,
            search = '',
            append = false
        } = options;

        const storeSnapshot = get() as TrajectoryStore;

        // Skip if already have trajectories (initial load only)
        if (!append && !search && page === 1 && storeSnapshot.trajectories.length > 0) {
            return;
        }

        if (append && storeSnapshot.isFetchingMore) {
            return;
        }

        const fetchTrajectories = () => {
                return trajectoryApi.getAllPaginated({
                    populate: 'analysis,createdBy',
                    page,
                    limit,
                    q: search
                });
            };

            await runRequest(set, get, fetchTrajectories, {
                loadingKey: append ? 'isFetchingMore' : 'isLoadingTrajectories',
                errorFallback: 'Failed to load trajectories',
                onSuccess: (apiResponse) => {
                    const paginationResult = calculatePaginationState({
                        newData: apiResponse.data || [],
                        currentData: storeSnapshot.trajectories,
                        page,
                        limit,
                        append,
                        totalFromApi: apiResponse.total,
                        previousTotal: storeSnapshot.listingMeta.total
                    });

                    set({
                        trajectories: paginationResult.data,
                        listingMeta: paginationResult.listingMeta
                    });
                }
            });
    },

    getTrajectoryById: async (trajectoryId) => {
        const fetchTrajectory = () => trajectoryApi.getOne(trajectoryId, 'team,analysis');

        await runRequest(set, get, fetchTrajectory, {
            errorFallback: 'Failed to load trajectory',
            loadingKey: 'isLoading',
            onSuccess: (trajectory) => {
                set({ trajectory } as Partial<TrajectoryStore>);
            }
        });
    },

    createTrajectory: async (formData) => {
        const uploadId = uuidv4();

        set((currentStore: TrajectoryStore) => ({
            activeUploads: {
                ...currentStore.activeUploads,
                [uploadId]: 0
            }
        }));

        try {
            const handleUploadProgress = (progress: number) => {
                set((currentStore: TrajectoryStore) => ({
                    activeUploads: {
                        ...currentStore.activeUploads,
                        [uploadId]: progress
                    }
                }));
            };

            const createdTrajectory = await trajectoryApi.create(formData, handleUploadProgress);

            set((currentStore: TrajectoryStore) => ({
                activeUploads: removeUploadProgress(uploadId, currentStore.activeUploads),
                trajectories: [createdTrajectory as Trajectory, ...currentStore.trajectories],
                error: null
            }));

            return createdTrajectory;
        } catch (error) {
            set((currentStore: TrajectoryStore) => ({
                activeUploads: removeUploadProgress(uploadId, currentStore.activeUploads),
                error: extractErrorMessage(error, 'Error uploading')
            }));

            throw error;
        }
    },

    updateTrajectoryById: async (trajectoryId, patch) => {
        const storeSnapshot = get() as TrajectoryStore;

        const rollbackSnapshot = {
            trajectories: storeSnapshot.trajectories,
            trajectory: storeSnapshot.trajectory
        };

        set((currentStore: TrajectoryStore) => patchTrajectoryInStore(currentStore, trajectoryId, patch));

        try {
            await trajectoryApi.update(trajectoryId, patch);
        } catch (error) {
            set(rollbackSnapshot);
            set({ error: extractErrorMessage(error) });
            throw error;
        }
    },

    deleteSelectedTrajectories: async () => {
        const storeSnapshot = get();
        const selectedTrajectoryIds = storeSnapshot.selectedTrajectories;

        if (!selectedTrajectoryIds.length) {
            return;
        }

        const rollbackSnapshot = {
            trajectories: storeSnapshot.trajectories,
            trajectory: storeSnapshot.trajectory,
            selectedTrajectories: selectedTrajectoryIds
        };

        set((currentStore) =>
            removeTrajectoriesFromStore(currentStore, selectedTrajectoryIds)
        );

        try {
            await Promise.all(
                selectedTrajectoryIds.map((trajectoryId) => trajectoryApi.delete(trajectoryId))
            );
        } catch (error) {
            set(rollbackSnapshot);
            throw error;
        }
    },

    deleteTrajectoryById: async (trajectoryId) => {
        const storeSnapshot = get();

        const rollbackSnapshot = {
            trajectories: storeSnapshot.trajectories,
            trajectory: storeSnapshot.trajectory
        };

        set((currentStore: TrajectoryStore) => {
            const nextTrajectories = currentStore.trajectories.filter(
                (trajectory) => trajectory._id !== trajectoryId
            );

            const currentTrajectory = currentStore.trajectory;
            const nextCurrentTrajectory =
                currentTrajectory && currentTrajectory._id === trajectoryId
                    ? null
                    : currentTrajectory;

            return {
                trajectories: nextTrajectories,
                trajectory: nextCurrentTrajectory
            };
        });

        clearTrajectoryPreviewCache(trajectoryId);

        try {
            await trajectoryApi.delete(trajectoryId);
        } catch (error) {
            set(rollbackSnapshot);
            set({ error: extractErrorMessage(error) });
            throw error;
        }
    },

    toggleTrajectorySelection: (trajectoryId) => {
        const storeSnapshot = get() as TrajectoryStore;

        const nextSelectedTrajectories = toggleIdInSelection(
            storeSnapshot.selectedTrajectories,
            trajectoryId
        );

        set({ selectedTrajectories: nextSelectedTrajectories });
    },

    getMetrics: async (trajectoryId, options) => {
        const storeSnapshot = get() as TrajectoryStore;
        const currentMetricsTrajectoryId = (storeSnapshot.trajectoryMetrics as any)?.trajectory?._id;

        const shouldSkip = currentMetricsTrajectoryId === trajectoryId && !options?.force;
        if (shouldSkip) {
            return;
        }

        const fetchMetrics = () => trajectoryApi.getMetrics();

        await runRequest(set, get, fetchMetrics, {
            loadingKey: 'isMetricsLoading',
            errorFallback: 'Failed to load metrics',
            onSuccess: (trajectoryMetrics) => {
                set({ trajectoryMetrics });
            }
        });
    },

    clearCurrentTrajectory: () => {
        set({
            trajectory: null,
            error: null,
            selectedTrajectories: []
        });
    },

    reset: () => {
        trajectoryPreviewCache.clear();
        set(initialState);
    }
});
