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
import useTrajectoryStore from '@/stores/trajectories';
import type { Trajectory, AnalysisConfig } from '@/types/models';

interface TimestepData{
    timesteps: number[];
    minTimestep: number;
    maxTimestep: number;
    timestepCount: number;
}

interface EditorState{
    isPlaying: boolean;
    playSpeed: number;
    currentTimestep?: number;
    intervalId: ReturnType<typeof setInterval> | null;
    analysisConfig: AnalysisConfig;
    timestepData: TimestepData,
    currentGltfUrl: string | null;
    nextGltfUrl: string | null;
}

interface EditorActions{
    togglePlay: () => void;
    setPlaySpeed: (speed: number) => void;
    setCurrentTimestep: (timestep: number) => void;
    setAnalysisConfig: <K extends keyof AnalysisConfig>(key: K, value: AnalysisConfig[K]) => void;
    selectTrajectory: (trajectory: Trajectory) => void;
    playNextFrame: () => void;
    stopPlayback: () => void;
    reset: () => void;
}

const initialAnalysisConfig: AnalysisConfig = {
    crystalStructure: 'BCC',
    identificationMode: 'PTM',
    maxTrialCircuitSize: 14.0,
    circuitStretchability: 9.0,
    defectMeshSmoothingLevel: 8,
    lineSmoothingLevel: 1.0,
    linePointInterval: 2.5,
    onlyPerfectDislocations: false,
    markCoreAtoms: false
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
            if(!timestepData.timesteps || !currentTimestep || timestepData.timesteps.length === 0){
                get().stopPlayback();
                return;
            }

            const currentIndex = timestepData.timesteps.indexOf(currentTimestep);
            const nextIndex = currentIndex + 1;
            // Loop back!
            if(nextIndex >= timestepData.timesteps.length){
                set({ currentTimestep: timestepData.timesteps[0] });
            }else{
                set({ currentTimestep: timestepData.timesteps[nextIndex] });
            }
            
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