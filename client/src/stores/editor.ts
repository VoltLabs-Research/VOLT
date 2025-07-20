import { create, type StateCreator } from 'zustand';
import useTrajectoryStore from './trajectories';

interface EditorState{
    isPlaying: boolean;
    playSpeed: number;
    currentTimestep?: number;
    analysisConfig: {
        crystal_structure: 'FCC' | 'BCC' | 'HCP';
        identification_mode: 'PTM' | 'CNA';
        max_trial_circuit_size: number;
        circuit_stretchability: number;
        defect_mesh_smoothing_level: number;
        line_smoothing_level: number;
        line_point_interval: number;
        only_perfect_dislocations: boolean;
        mark_core_atoms: boolean;   
    };
    timestepData: {
        timesteps: number[],
        minTimestep: number;
        maxTimestep: number;
        timestepCount: number;
    };
    currentGltfUrl: string | null;
    nextGltfUrl: string | null;
}

interface EditorActions{
    togglePlay: () => void;
    setPlaySpeed: (speed: number) => void;
    setCurrentTimestep: (timestep: number) => void;
    setAnalysisConfig: (key: string, value: any) => void;
    selectTrajectory: (trajectory: any) => void;
    playNextFrame: () => void; 
}

const initialAnalysisConfig = {
    crystal_structure: 'BCC',
    identification_mode: 'PTM',
    max_trial_circuit_size: 14.0,
    circuit_stretchability: 9.0,
    defect_mesh_smoothing_level: 8,
    line_smoothing_level: 1.0,
    line_point_interval: 2.5,
    only_perfect_dislocations: false,
    mark_core_atoms: false
}

const initialState: EditorState = {
    isPlaying: false,
    playSpeed: 1,
    currentTimestep: undefined,
    analysisConfig: initialAnalysisConfig,
    timestepData: { timesteps: [], minTimestep: 0, maxTimestep: 0, timestepCount: 0 },
    currentGltfUrl: null,
    nextGltfUrl: null
};

const editorStoreCreator: StateCreator<EditorState & EditorActions> = (set, get) => {
    const computeDerivedState = () => {
        const trajectory = useTrajectoryStore.getState().trajectory;
        const currentTimestep = get().currentTimestep;
        
        if(!trajectory?.frames || trajectory.frames.length === 0){
            return {
                timestepData: initialState.timestepData,
                currentGltfUrl: null,
                nextGltfUrl: null
            };
        }

        const timesteps = trajectory.frames.map((frame: any) => frame.timestep).sort((a: number, b: number) => a - b);
        const timestepData = {
            timesteps,
            minTimestep: timesteps[0] || 0,
            maxTimestep: timesteps[timesteps.length - 1] || 0,
            timestepCount: timesteps.length
        };

        let currentGltfUrl = null;
        let nextGltfUrl = null;

        if(trajectory?._id && currentTimestep !== undefined && timesteps.length > 0){
            const buildUrl = (ts: number) => `/trajectories/${trajectory._id}/gltf/${ts}`;
            currentGltfUrl = buildUrl(currentTimestep);
            
            const currentIndex = timesteps.indexOf(currentTimestep);
            if(currentIndex !== -1 && timesteps.length > 1){
                const nextIndex = (currentIndex + 1) % timesteps.length;
                const nextTimestep = timesteps[nextIndex];
                nextGltfUrl = buildUrl(nextTimestep);
            }
        }

        return { timestepData, currentGltfUrl, nextGltfUrl };
    };

    return {
        ...initialState,

        togglePlay: () => set(state => ({ isPlaying: !state.isPlaying })),
        setPlaySpeed: (speed) => set({ playSpeed: speed }),
        
        setCurrentTimestep: (timestep) => {
            set({ isPlaying: false, currentTimestep: timestep });
            set(computeDerivedState());
        },

        setAnalysisConfig: (key, value) => set(state => ({
            analysisConfig: { ...state.analysisConfig, [key]: value }
        })),

        selectTrajectory: (trajectoryData) => {
            useTrajectoryStore.setState({ trajectory: trajectoryData });

            let firstTimestep: number | undefined = undefined;
            if(trajectoryData?.frames?.length > 0){
                firstTimestep = trajectoryData.frames.map((frame: any) => frame.timestep).sort((a: number, b: number) => a  - b)[0];
            }

            set({ currentTimestep: firstTimestep, isPlaying: false });
            set(computeDerivedState());
        },

        playNextFrame: () => {
            const { timestepData, currentTimestep } = get();
            if(!timestepData.timesteps || timestepData.timesteps.length === 0) return;
            const currentIndex = currentTimestep === undefined ? -1 : timestepData.timesteps.indexOf(currentTimestep);
            const nextIndex = (currentIndex + 1) % timestepData.timesteps.length;
            const nextTimestep = timestepData.timesteps[nextIndex];

            set({ currentTimestep: nextTimestep });
            set(computeDerivedState());
        },

        reset: () => set(initialState)
    };
};

const useEditorStore = create(editorStoreCreator);

export default useEditorStore;