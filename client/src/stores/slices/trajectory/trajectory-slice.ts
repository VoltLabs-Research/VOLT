import { calculatePaginationState } from '@/utilities/api/pagination-utils';
import type { Trajectory } from '@/types/models';
import { v4 as uuidv4 } from 'uuid';
import type { TrajectoryState, TrajectoryStore } from '@/types/stores/trajectories';
import PreviewCacheService from '@/services/common/preview-cache-service';
import { clearTrajectoryPreviewCache } from '@/hooks/trajectory/use-trajectory-preview';
import trajectoryApi from '@/services/api/trajectory/trajectory';
import { useTeamStore } from '@/stores/slices/team';
import { runRequest, extractError } from '../../helpers';
import type { SliceCreator } from '../../helpers/create-slice';

const previewCache = new PreviewCacheService();

function upsert<T extends { _id: string }>(list: T[], item: T): T[] {
    if (!item?._id) return list;
    return [{ ...(list.find(t => t._id === item._id) || {}), ...item } as T, ...list.filter(t => t._id !== item._id)];
}

function dedupe<T extends { _id: string }>(list: T[]): T[] {
    const seen = new Set<string>();
    return list.filter(t => t?._id && !seen.has(t._id) && seen.add(t._id));
}

export const initialState: TrajectoryState = {
    trajectories: [], listingMeta: { page: 1, limit: 20, total: 0, hasMore: false },
    trajectory: null, isLoading: true, isFetchingMore: false, uploadingFileCount: 0,
    activeUploads: {}, error: null, isMetricsLoading: false, trajectoryMetrics: {},
    selectedTrajectories: [], isLoadingTrajectories: true
};

export const createTrajectorySlice: SliceCreator<TrajectoryStore> = (set, get) => ({
    ...initialState,

    getTrajectories: async (teamId, opts = {}) => {
        const { page = 1, limit = 20, search = '', append = false } = opts;
        const s = get() as TrajectoryStore;
        if (append && s.isFetchingMore) return;

        await runRequest(set, get, () => trajectoryApi.getAllPaginated({ populate: 'analysis,createdBy', page, limit, q: search }), {
            loadingKey: append ? 'isFetchingMore' : 'isLoadingTrajectories',
            errorFallback: 'Failed to load trajectories',
            onSuccess: (response) => {
                const { data, listingMeta } = calculatePaginationState({
                    newData: response.data || [], currentData: s.trajectories, page, limit, append,
                    totalFromApi: response.total, previousTotal: s.listingMeta.total
                });
                set({ trajectories: dedupe(data), listingMeta } as Partial<TrajectoryStore>);
            }
        });
    },

    getTrajectoryById: async (id) => {
        await runRequest(set, get, () => trajectoryApi.getOne(id, 'team,analysis'), {
            errorFallback: 'Failed to load trajectory',
            onSuccess: (trajectory) => set({ trajectory } as Partial<TrajectoryStore>)
        });
    },

    createTrajectory: async (formData) => {
        const uploadId = uuidv4();
        set((s: TrajectoryStore) => ({ activeUploads: { ...s.activeUploads, [uploadId]: 0 } }));
        try {
            const traj = await trajectoryApi.create(formData, (p) => set((s: TrajectoryStore) => ({ activeUploads: { ...s.activeUploads, [uploadId]: p } })));
            set((s: TrajectoryStore) => { const { [uploadId]: _, ...rest } = s.activeUploads; return { activeUploads: rest, trajectories: upsert(s.trajectories, traj as Trajectory), error: null }; });
            return traj;
        } catch (e) {
            set((s: TrajectoryStore) => { const { [uploadId]: _, ...rest } = s.activeUploads; return { activeUploads: rest, error: extractError(e, 'Error uploading') }; });
            throw e;
        }
    },

    updateTrajectoryById: async (id, data) => {
        const s = get() as TrajectoryStore;
        const orig = { trajectories: s.trajectories, trajectory: s.trajectory };
        set((st: TrajectoryStore) => ({
            trajectories: st.trajectories.map(t => t._id === id ? { ...t, ...data } : t),
            trajectory: st.trajectory?._id === id ? { ...st.trajectory!, ...data } : st.trajectory
        }));
        try { await trajectoryApi.update(id, data); } catch (e) { set(orig as Partial<TrajectoryStore>); set({ error: extractError(e) } as Partial<TrajectoryStore>); throw e; }
    },

    deleteSelectedTrajectories: async () => {
        const s = get() as TrajectoryStore;
        const ids = s.selectedTrajectories;
        if (!ids.length) return;
        const orig = { trajectories: s.trajectories, trajectory: s.trajectory, selectedTrajectories: ids };
        set((st: TrajectoryStore) => ({ trajectories: st.trajectories.filter(t => !ids.includes(t._id)), trajectory: st.trajectory && ids.includes(st.trajectory._id) ? null : st.trajectory, selectedTrajectories: [] }));
        try { await Promise.all(ids.map(id => trajectoryApi.delete(id))); } catch (e) { set(orig as Partial<TrajectoryStore>); throw e; }
    },

    deleteTrajectoryById: async (id) => {
        const s = get() as TrajectoryStore;
        const orig = { trajectories: s.trajectories, trajectory: s.trajectory };
        set((st: TrajectoryStore) => ({ trajectories: st.trajectories.filter(t => t._id !== id), trajectory: st.trajectory?._id === id ? null : st.trajectory }));
        clearTrajectoryPreviewCache(id);
        try { await trajectoryApi.delete(id); } catch (e) { set(orig as Partial<TrajectoryStore>); set({ error: extractError(e) } as Partial<TrajectoryStore>); throw e; }
    },

    toggleTrajectorySelection: (id) => {
        const s = get() as TrajectoryStore;
        set({ selectedTrajectories: s.selectedTrajectories.includes(id) ? s.selectedTrajectories.filter(x => x !== id) : [...s.selectedTrajectories, id] } as Partial<TrajectoryStore>);
    },

    getFrameAtoms: async (trajectoryId, timestep, opts) => {
        try {
            return await trajectoryApi.getAtoms(trajectoryId, useTeamStore.getState().selectedTeam?._id, 'default', {
                timestep, exposureId: 'default', page: opts?.page ?? 1, pageSize: opts?.pageSize ?? 100000
            }) as any;
        } catch { return null; }
    },

    getMetrics: async (id, opts) => {
        const s = get() as TrajectoryStore;
        if ((s.trajectoryMetrics as any)?.trajectory?._id === id && !opts?.force) return;
        await runRequest(set, get, () => trajectoryApi.getMetrics(id), {
            loadingKey: 'isMetricsLoading', errorFallback: 'Failed to load metrics',
            onSuccess: (trajectoryMetrics) => set({ trajectoryMetrics } as Partial<TrajectoryStore>)
        });
    },

    setTrajectory: (trajectory) => set({ trajectory } as Partial<TrajectoryStore>),
    clearError: () => set({ error: null } as Partial<TrajectoryStore>),
    clearCurrentTrajectory: () => set({ trajectory: null, error: null, selectedTrajectories: [] } as Partial<TrajectoryStore>),
    reset: () => { previewCache.clear(); set(initialState as TrajectoryStore); }
});

export function dataURLToBlob(dataURL: string): Blob {
    const [header, data] = dataURL.split(',');
    const isBase64 = /;base64/i.test(header);
    const mime = header.match(/data:([^;]+)/i)?.[1] || 'application/octet-stream';
    if (isBase64) {
        const bin = atob(data);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return new Blob([arr], { type: mime });
    }
    return new Blob([decodeURIComponent(data)], { type: mime });
}

export const dataURLToObjectURL = (url: string) => URL.createObjectURL(dataURLToBlob(url));
