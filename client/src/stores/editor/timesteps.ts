import { create } from 'zustand';
import type { Trajectory } from '@/types/models';

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
}

interface TimestepActions {
    computeTimestepData: (trajectory: Trajectory | null, currentTimestep?: number) => void;
    reset: () => void;
}

export type TimestepStore = TimestepState & TimestepActions;

const initialTimestepData: TimestepData = {
    timesteps: [],
    minTimestep: 0,
    maxTimestep: 0,
    timestepCount: 0,
};

const initialState: TimestepState = {
    timestepData: initialTimestepData,
    currentGlbUrl: null,
    nextGlbUrl: null,
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

const buildGlbUrl = (trajectoryId: string, timestep: number, type: string = ''): string => {
    return `/trajectories/${trajectoryId}/glb/${timestep}${type ? `?type=${type}` : ''}`;
};

const createTrajectoryGLBs = (trajectoryId: string, timestep: number): TrajectoryGLBs => ({
    trajectory: buildGlbUrl(trajectoryId, timestep),
    defect_mesh: buildGlbUrl(trajectoryId, timestep, 'defect_mesh'),
    interface_mesh: buildGlbUrl(trajectoryId, timestep, 'interface_mesh'),
    atoms_colored_by_type: buildGlbUrl(trajectoryId, timestep, 'atoms_colored_by_type'),
    dislocations: buildGlbUrl(trajectoryId, timestep, 'dislocations'),
    core_atoms: '', // Empty as in original
});

// Store implementation
const useTimestepStore = create<TimestepStore>()((set) => ({
    ...initialState,

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
            currentGlbUrl = createTrajectoryGLBs(trajectory._id, currentTimestep);
            
            // Calculate next timestep URL for preloading
            const currentIndex = timesteps.indexOf(currentTimestep);
            if (currentIndex !== -1 && timesteps.length > 1) {
                const nextIndex = (currentIndex + 1) % timesteps.length;
                const nextTimestep = timesteps[nextIndex];
                nextGlbUrl = createTrajectoryGLBs(trajectory._id, nextTimestep);
            }
        }

        set({
            timestepData,
            currentGlbUrl,
            nextGlbUrl,
        });
    },

    reset: () => set(initialState)
}));

export default useTimestepStore;