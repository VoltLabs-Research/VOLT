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
    slicingOrigin: { x: number; y: number; z: number };
}

interface ConfigurationActions {
    setSlicePlaneConfig: (config: Partial<SlicePlaneConfig>) => void;
    resetSlicePlaneConfig: () => void;
    setSlicingOrigin: (origin: { x: number; y: number; z: number }) => void;
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

const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
    crystalStructure: 'BCC',
    identificationMode: 'CNA',
    maxTrialCircuitSize: 14.0,
    circuitStretchability: 9.0,
    RMSD: 0.10,
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
    slabWidth: 0,
    reverseOrientation: false,
};

const DEFAULT_SCENE_OBJECT: SceneObjectType = 'trajectory';

const initialState: ConfigurationState = {
    slicePlaneConfig: DEFAULT_SLICE_PLANE_CONFIG,
    analysisConfig: DEFAULT_ANALYSIS_CONFIG,
    activeSceneObject: DEFAULT_SCENE_OBJECT,
    isModelLoading: false,
    activeSidebarTab: 'Scene',
    activeSidebarOption: '',
    activeModifier: '',
    slicingOrigin: { x: 0, y: 0, z: 0 },
};

const useConfigurationStore = create<ConfigurationStore>()(persist((set, get) => ({
        ...initialState,

        setSlicePlaneConfig: (config: Partial<SlicePlaneConfig>) => {
            const current = get().slicePlaneConfig;
            const mergedNormal = { ...current.normal, ...(config.normal || {}) };
            const next = {
                normal: mergedNormal,
                distance: typeof config.distance === 'number' ? config.distance : current.distance,
                slabWidth: typeof config.slabWidth === 'number' ? config.slabWidth : current.slabWidth,
                reverseOrientation: typeof config.reverseOrientation === 'boolean' ? config.reverseOrientation : current.reverseOrientation,
            };
            set({ slicePlaneConfig: next });
        },

        setSlicingOrigin: (origin) => {
            set({ slicingOrigin: origin });
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
