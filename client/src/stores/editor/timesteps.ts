import { create } from 'zustand';
import type { Trajectory } from '@/types/models';
import useAnalysisConfigStore from '@/stores/analysis-config';
import useModelStore from '@/stores/editor/model';
import useTrajectoryStore from '@/stores/trajectories';
import { createTrajectoryGLBs, fetchModels, type TimelineGLBMap } from '@/utilities/glb/modelUtils';
import type { TimestepData, TimestepState, TimestepStore } from '@/types/stores/editor/timesteps';

const initialTimestepData: TimestepData = {
    timesteps: [],
    minTimestep: 0,
    maxTimestep: 0,
    timestepCount: 0
};

const initialState: TimestepState = {
    timestepData: initialTimestepData,
    isRenderOptionsLoading: false
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

const useTimestepStore = create<TimestepStore>()((set, get) => ({
    ...initialState,

    async loadModels(preloadBehavior?: boolean, onProgress?: (p: number, m?: { bps: number }) => void): Promise<TimelineGLBMap>{
        const trajectory = useTrajectoryStore.getState().trajectory;
        const analysis = useAnalysisConfigStore.getState().analysisConfig;
        const { timesteps } = get().timestepData;

        if(!trajectory?._id) throw new Error('No trajectory loaded');
        if(!analysis?._id) throw new Error('No analysis configuration available');
        if(timesteps.length === 0) throw new Error('No timesteps available in trajectory');

        const map = await fetchModels({
            trajectoryId: trajectory._id,
            analysisId: analysis._id,
            timesteps,
            preloadBehavior,
            concurrency: 6,
            onProgress
        });

        return map;
    },

    computeTimestepData(trajectory: Trajectory | null, currentTimestep?: number, cacheBuster?: number){
        if(!trajectory?.frames || trajectory.frames.length === 0){
            set({ timestepData: initialTimestepData });
            return;
        }

        const timesteps = extractTimesteps(trajectory);
        const timestepData = createTimestepData(timesteps);

        // No seleccionamos el modelo automáticamente - esto evita la precarga de GLBs
        // Nota: Solo generamos las URLs pero no las cargamos
        // La carga se hará explícitamente cuando el usuario haga doble clic en RasterScene
        if(trajectory._id && currentTimestep !== undefined && timesteps.length > 0){
            // Obtener el ID del análisis actual del store, no del trajectory
            const currentAnalysis = useAnalysisConfigStore.getState().analysisConfig;
            const analysisId = currentAnalysis?._id || '';
                
            // Si no hay análisis, usar un ID por defecto para permitir la carga del GLB
            const finalAnalysisId = analysisId || 'default';
            
            const glbs = createTrajectoryGLBs(
                trajectory._id,
                currentTimestep,
                finalAnalysisId,
                cacheBuster
            );
            
            // Always update model when analysis or timestep changes to ensure reload
            useModelStore.getState().selectModel(glbs);
        }

        set({ timestepData });
    },

    reset: () => set(initialState)
}));

export default useTimestepStore;
