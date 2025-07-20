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

import { create, type StateCreator } from 'zustand';
import useTrajectoryStore from './trajectories';

interface EditorState{
    isPlaying: boolean;
    playSpeed: number;
    currentTimestep?: number;
    intervalId: NodeJS.Timeout | null;
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
    stopPlayback: () => void;
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
    intervalId: null,
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

        stopPlayback: () => {
            const intervalId = get().intervalId;
            if(intervalId){
                clearInterval(intervalId);
            }
            set({ isPlaying: false, intervalId: null });
        },

        togglePlay: () => {
            const { isPlaying } = get();
            if(isPlaying){
                get().stopPlayback();
            }else{
                set({ isPlaying: true });
                const newIntervalId = setInterval(() => {
                    get().playNextFrame();
                }, 1000 / get().playSpeed);
                set({ intervalId: newIntervalId });
            }
        },

        setPlaySpeed: (speed) => {
            set({ playSpeed: speed });
            if(get().isPlaying){
                get().stopPlayback();
                get().togglePlay();
            }
        },

        setCurrentTimestep: (timestep) => {
            get().stopPlayback();
            set({ currentTimestep: timestep });
            set(computeDerivedState());
        },

        setAnalysisConfig: (key, value) => set(state => ({
            analysisConfig: { ...state.analysisConfig, [key]: value }
        })),

        selectTrajectory: (trajectoryData) => {
            get().stopPlayback();
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
            if(!timestepData.timesteps || timestepData.timesteps.length === 0){
                get().stopPlayback();
                return;
            }

            const currentIndex = currentTimestep === undefined ? -1 : timestepData.timesteps.indexOf(currentTimestep);
            const nextIndex = (currentIndex + 1) % timestepData.timesteps.length;
            
            if(nextIndex >= timestepData.timesteps.length){
                get().stopPlayback();
                return;
            }

            const nextTimestep = timestepData.timesteps[nextIndex];

            set({ currentTimestep: nextTimestep });
            set(computeDerivedState());
        },

        reset: () => {
            get().stopPlayback();
            set(initialState);
        }
    };
};

const useEditorStore = create(editorStoreCreator);

export default useEditorStore;