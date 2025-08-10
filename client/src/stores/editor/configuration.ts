import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AnalysisConfig } from '@/types/models';

export interface SlicePlaneConfig {
    normal: { x: number; y: number; z: number };
    distance: number;
    slabWidth: number;
    reverseOrientation: boolean;
}

export type SceneObjectType = 
    | 'trajectory' 
    | 'dislocations' 
    | 'defect_mesh'
    | 'core_atoms' 
    | 'interface_mesh' 
    | 'atoms_colored_by_type';

interface ConfigurationState {
    slicePlaneConfig: SlicePlaneConfig;
    analysisConfig: AnalysisConfig;
    activeSceneObject: SceneObjectType;
    activeSidebarTab: string;
    activeSidebarOption: string;
    isModelLoading: boolean;
    activeModifier: string;
}

interface ConfigurationActions {
    setSlicePlaneConfig: (config: Partial<SlicePlaneConfig>) => void;
    resetSlicePlaneConfig: () => void;
    setAnalysisConfig: <K extends keyof AnalysisConfig>(
        key: K,
        value: AnalysisConfig[K]
    ) => void;
    updateAnalysisConfig: (config: Partial<AnalysisConfig>) => void;
    resetAnalysisConfig: () => void;
    setActiveSidebarTag: (tag: string) => void;
    setActiveModifier: (modifier: string) => void;
    setActiveSidebarOption: (option: string) => void;
    setActiveSceneObject: (sceneObject: SceneObjectType) => void;
    setIsModelLoading: (loading: boolean) => void;
    reset: () => void;
}

export type ConfigurationStore = ConfigurationState & ConfigurationActions;

// CNA?
const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
    crystalStructure: 'CUBIC_DIAMOND',
    identificationMode: 'PTM',
    maxTrialCircuitSize: 14.0,
    circuitStretchability: 9.0,
    defectMeshSmoothingLevel: 8,
    lineSmoothingLevel: 5,
    linePointInterval: 2.5,
    onlyPerfectDislocations: false,
    markCoreAtoms: false,
    structureIdentificationOnly: false
};

const DEFAULT_SLICE_PLANE_CONFIG: SlicePlaneConfig = {
    normal: { x: 0, y: 0, z: 0 },
    distance: 0,
    slabWidth: 0.05,
    reverseOrientation: true,
};

const DEFAULT_SCENE_OBJECT: SceneObjectType = 'trajectory';

const initialState: ConfigurationState = {
    slicePlaneConfig: DEFAULT_SLICE_PLANE_CONFIG,
    analysisConfig: DEFAULT_ANALYSIS_CONFIG,
    activeSceneObject: DEFAULT_SCENE_OBJECT,
    isModelLoading: false,
    activeSidebarTab: 'Scene',
};

const useConfigurationStore = create<ConfigurationStore>()(persist((set, get) => ({
        ...initialState,

        setSlicePlaneConfig: (config: Partial<SlicePlaneConfig>) => {
            const currentConfig = get().slicePlaneConfig;
            set({ 
                slicePlaneConfig: { ...currentConfig, ...config }
            });
        },

        setActiveSidebarOption(option: string){
            set({ activeSidebarOption: option });
        },

        setActiveSidebarTag(tag: string){
            set({ activeSidebarTab: tag });
        },

        setActiveModifier(modifier: string){
            set({ activeModifier: modifier });
        },

        resetSlicePlaneConfig: () => {
            set({ slicePlaneConfig: DEFAULT_SLICE_PLANE_CONFIG });
        },

        setAnalysisConfig: (key, value) => {
            const currentConfig = get().analysisConfig;
            set({
                analysisConfig: { ...currentConfig, [key]: value },
            });
        },

        updateAnalysisConfig: (config: Partial<AnalysisConfig>) => {
            const currentConfig = get().analysisConfig;
            set({
                analysisConfig: { ...currentConfig, ...config },
            });
        },

        resetAnalysisConfig: () => {
            set({ analysisConfig: DEFAULT_ANALYSIS_CONFIG });
        },

        setActiveSceneObject: (sceneObject: SceneObjectType) => {
            set({ activeSceneObject: sceneObject });
        },

        setIsModelLoading: (loading: boolean) => {
            set({ isModelLoading: loading });
        },

        reset: () => {
            set(initialState);
        },
    }),
    {
        name: 'configuration-storage',
        partialize: (state) => ({
            slicePlaneConfig: state.slicePlaneConfig,
            analysisConfig: state.analysisConfig,
            activeSceneObject: state.activeSceneObject,
        }),
    }
));

export default useConfigurationStore;