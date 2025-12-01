/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import { useRef, useCallback, useEffect } from 'react';
import useTrajectoryManager from '@/hooks/trajectory/use-trajectory-manager';
import usePlaybackStore from '@/stores/editor/playback';
import useTimestepStore from '@/stores/editor/timesteps';
import useModelStore from '@/stores/editor/model';

const useCanvasState = (trajectoryId: string | undefined) => {
    const currentTimestep = usePlaybackStore((state) => state.currentTimestep);
    const setCurrentTimestep = usePlaybackStore((state) => state.setCurrentTimestep);
    const isModelLoading = useModelStore((state) => state.isModelLoading);
    
    const { trajectory, loadTrajectory } = useTrajectoryManager();
    const computeTimestepData = useTimestepStore((state) => state.computeTimestepData);

    const isInitialLoadDone = useRef(false);
    const trajectoryIdRef = useRef(trajectoryId);

    const selectTrajectory = useCallback((newTrajectory: any) => {
        computeTimestepData(newTrajectory);
        
        if (newTrajectory?.frames?.length > 0) {
            const firstTimestep = newTrajectory.frames
                .map((frame: any) => frame.timestep)
                .sort((a: number, b: number) => a - b)[0];
            
            setCurrentTimestep(firstTimestep);
        }
    }, [setCurrentTimestep]);


    useEffect(() => {
        selectTrajectory(null);
        isInitialLoadDone.current = false;
    }, [selectTrajectory]);

    useEffect(() => {
        if (!trajectoryId) return;
        
        const currentTrajectoryId = trajectory?._id;
        const isSameTrajectory = currentTrajectoryId === trajectoryId && trajectory;
        const isAlreadyLoaded = isInitialLoadDone.current && trajectoryIdRef.current === trajectoryId;

        if (isSameTrajectory || isAlreadyLoaded) return;

        trajectoryIdRef.current = trajectoryId;
        isInitialLoadDone.current = true;

        loadTrajectory(trajectoryId).then((loadedTrajectory) => {
            if (loadedTrajectory) {
                selectTrajectory(loadedTrajectory);
            }
        });
    }, [trajectoryId, trajectory, loadTrajectory, selectTrajectory]);

    return {
        trajectory,
        isReady: isInitialLoadDone.current,
        currentTimestep,
        selectTrajectory,
        isModelLoading,
        setTimestep: setCurrentTimestep
    };
};

export default useCanvasState;