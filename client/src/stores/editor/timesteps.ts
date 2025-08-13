import { create } from 'zustand';
import type { Trajectory } from '@/types/models';
import { api } from '@/services/api';
import { clearTrajectoryPreviewCache } from '@/hooks/trajectory/use-trajectory-preview';
import useTrajectoryStore from '../trajectories';
import useAnalysisConfigStore from '../analysis-config';

export interface TimestepData {
    timesteps: number[];
    minTimestep: number;
    maxTimestep: number;
    timestepCount: number;
}

export interface TrajectoryGLBs {
    trajectory: string;
    defect_mesh: string;
    interface_mesh: string;
    dislocations: string;
    core_atoms: string;
    atoms_colored_by_type: string;
}

interface TimestepState {
    timestepData: TimestepData;
    currentGlbUrl: TrajectoryGLBs | null;
    nextGlbUrl: TrajectoryGLBs | null;
    isRenderOptionsLoading: boolean;
    lastRefreshTimestamp: number;
    modelBounds: any;
}

interface TimestepActions {
    computeTimestepData: (trajectory: Trajectory | null, currentTimestep?: number) => void;
    refreshGlbUrls: (trajectoryId: string, currentTimestep: number, analysisId: number) => void;
    reset: () => void;
    setModelBounds: (modelBounds: any) => void;
    dislocationRenderOptions: (trajectoryId: string, timestep: string, analysisId: string, options: any) => Promise<void>;
}

export type TimestepStore = TimestepState & TimestepActions;

const initialTimestepData: TimestepData = {
    timesteps: [],
    minTimestep: 0,
    maxTimestep: 0,
    timestepCount: 0
};

const initialState: TimestepState = {
    timestepData: initialTimestepData,
    currentGlbUrl: null,
    nextGlbUrl: null,
    isRenderOptionsLoading: false,
    lastRefreshTimestamp: 0,
    modelBounds: null
};

const extractTimesteps = (trajectory: Trajectory | null): number[] => {
    if (!trajectory?.frames || trajectory.frames.length === 0) {
        return [];
    }
    
    return trajectory.frames
        .map((frame: any) => frame.timestep)
        .sort((a: number, b: number) => a - b);
};

const createTimestepData = (timesteps: number[]): TimestepData => ({
    timesteps,
    minTimestep: timesteps[0] || 0,
    maxTimestep: timesteps[timesteps.length - 1] || 0,
    timestepCount: timesteps.length,
});

const buildGlbUrl = (
    trajectoryId: string, 
    timestep: number, 
    analysisId: number,
    type: string = '',
    cacheBuster?: number
): string => {
    const baseUrl = `/trajectories/${trajectoryId}/glb/${timestep}/${analysisId}`;
    const typeParam = type ? `type=${type}` : '';
    const cacheParam = cacheBuster ? `t=${cacheBuster}` : '';
    
    const params = [typeParam, cacheParam].filter(Boolean).join('&');
    return params ? `${baseUrl}?${params}` : baseUrl;
};

const createTrajectoryGLBs = (
    trajectoryId: string, 
    timestep: number, 
    analysisId: number, 
    cacheBuster?: number
): TrajectoryGLBs => ({
    trajectory: buildGlbUrl(trajectoryId, timestep, analysisId, '', cacheBuster),
    defect_mesh: buildGlbUrl(trajectoryId, timestep, analysisId, 'defect_mesh', cacheBuster),
    interface_mesh: buildGlbUrl(trajectoryId, timestep, analysisId, 'interface_mesh', cacheBuster),
    atoms_colored_by_type: buildGlbUrl(trajectoryId, timestep, analysisId, 'atoms_colored_by_type', cacheBuster),
    dislocations: buildGlbUrl(trajectoryId, timestep, analysisId, 'dislocations', cacheBuster),
    core_atoms: '',
});

const useTimestepStore = create<TimestepStore>()((set, get) => ({
    ...initialState,

    setModelBounds: (modelBounds: any) => {
        set({ modelBounds });
    },

    computeTimestepData: (trajectory: Trajectory | null, currentTimestep?: number) => {
        if (!trajectory?.frames || trajectory.frames.length === 0) {
            set({
                timestepData: initialTimestepData,
                currentGlbUrl: null,
                nextGlbUrl: null,
            });
            return;
        }

        const timesteps = extractTimesteps(trajectory);
        const timestepData = createTimestepData(timesteps);

        let currentGlbUrl: TrajectoryGLBs | null = null;
        let nextGlbUrl: TrajectoryGLBs | null = null;

        if (trajectory._id && currentTimestep !== undefined && timesteps.length > 0) {
            const analysis = useAnalysisConfigStore.getState().analysisConfig;
            const cacheBuster = get().lastRefreshTimestamp;
            
            currentGlbUrl = createTrajectoryGLBs(
                trajectory._id, 
                currentTimestep, 
                analysis._id, 
                cacheBuster || undefined
            );
            
            const currentIndex = timesteps.indexOf(currentTimestep);
            if (currentIndex !== -1 && timesteps.length > 1) {
                const nextIndex = (currentIndex + 1) % timesteps.length;
                const nextTimestep = timesteps[nextIndex];
                nextGlbUrl = createTrajectoryGLBs(
                    trajectory._id, 
                    nextTimestep, 
                    analysis._id, 
                    cacheBuster || undefined
                );
            }
        }

        set({
            timestepData,
            currentGlbUrl,
            nextGlbUrl,
        });
    },

    refreshGlbUrls: (trajectoryId: string, currentTimestep: number, analysisId: number) => {
        const state = get();
        const newTimestamp = Date.now();
        
        console.log(`Refreshing GLB URLs for trajectory ${trajectoryId}, timestep ${currentTimestep}, analysis ${analysisId}`);
        
        const currentGlbUrl = createTrajectoryGLBs(trajectoryId, currentTimestep, analysisId, newTimestamp);
        
        let nextGlbUrl: TrajectoryGLBs | null = null;
        if (state.timestepData.timesteps.length > 1) {
            const currentIndex = state.timestepData.timesteps.indexOf(currentTimestep);
            if (currentIndex !== -1) {
                const nextIndex = (currentIndex + 1) % state.timestepData.timesteps.length;
                const nextTimestep = state.timestepData.timesteps[nextIndex];
                nextGlbUrl = createTrajectoryGLBs(trajectoryId, nextTimestep, analysisId, newTimestamp);
            }
        }

        console.log('New GLB URLs:', currentGlbUrl);

        set({
            currentGlbUrl,
            nextGlbUrl,
            lastRefreshTimestamp: newTimestamp,
        });
    },
    
    dislocationRenderOptions: async (trajectoryId: string, timestep: string, analysisId: string, options: any) => {
        set({ isRenderOptionsLoading: true });
        
        try {
            console.log(`Applying render options for trajectory ${trajectoryId}, timestep ${timestep}, analysis ${analysisId}`);
            
            const url = `/modifiers/render-options/dislocations/${trajectoryId}/${timestep}/${analysisId}`;
            await api.post(url, options);
            
            console.log('Render options applied successfully');
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const currentTimestep = parseInt(timestep);
            const analysisIdNum = parseInt(analysisId);
            
            get().refreshGlbUrls(trajectoryId, currentTimestep, analysisIdNum);
            
            clearTrajectoryPreviewCache(trajectoryId);
            
            useTrajectoryStore.getState().clearCurrentTrajectory();
            
        } catch (error) {
            console.error('Error applying render options:', error);
            throw error;
        } finally {
            set({ isRenderOptionsLoading: false });
        }
    },

    reset: () => set(initialState)
}));

export default useTimestepStore;