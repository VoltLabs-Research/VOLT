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

import { useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import usePlaybackStore from '@/stores/editor/playback';
import useTimestepStore from '@/stores/editor/timesteps';
import useTrajectoryStore from '@/stores/trajectories';
import useLogger from '@/hooks/core/use-logger';
import useAnalysisConfigStore from '@/stores/analysis-config';

const useCanvasCoordinator = ({ trajectoryId }) => {
    const logger = useLogger('use-canvas-coordinator');

    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const getTrajectoryById = useTrajectoryStore((state) => state.getTrajectoryById);
    const isLoading = useTrajectoryStore((state) => state.isLoading);
    const error = useTrajectoryStore((state) => state.error);
    const clearCurrentTrajectory = useTrajectoryStore((state) => state.clearCurrentTrajectory);
    const updateAnalysisConfig = useAnalysisConfigStore((state) => state.updateAnalysisConfig);
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);

    const currentTimestep = usePlaybackStore((state) => state.currentTimestep);
    const setCurrentTimestep = usePlaybackStore((state) => state.setCurrentTimestep);
    const playNextFrame = usePlaybackStore((state) => state.playNextFrame);
    const resetPlayback = usePlaybackStore((state) => state.reset);

    const computeTimestepData = useTimestepStore((state) => state.computeTimestepData);
    const timestepData = useTimestepStore((state) => state.timestepData);
    const currentGlbUrl = useTimestepStore((state) => state.currentGlbUrl);
    const lastRefreshTimestamp = useTimestepStore((state) => state.lastRefreshTimestamp);
    const resetTimestep = useTimestepStore((state) => state.reset);

    // Load trajectory when hook is initialized
    useEffect(() => {
        if(trajectoryId && (!trajectory || trajectory?._id !== trajectoryId)){
            logger.log(`Loading trajectory with ID: ${trajectoryId}`);
            getTrajectoryById(trajectoryId);
        }
    }, [trajectoryId, trajectory, getTrajectoryById]);

    // Handle automatically the selection for the first timestep when trajectory is loaded
    useEffect(() => {
        if(trajectory && trajectory.frames?.length > 0 && currentTimestep === undefined){
            const firstTimestep = trajectory.frames
                ?.map((frame: any) => frame.timestep)
                .sort((a: number, b: number) => a - b)[0];
            logger.log(`Setting initial timestep: ${firstTimestep}`);
            setCurrentTimestep(firstTimestep);
            
            // If trajectory has analysis configs, then select the most recent
            if((trajectory.analysis ?? []).length >= 1){
                const config = trajectory.analysis[trajectory.analysis.length - 1];
                updateAnalysisConfig(config);
            }
        }
    }, [trajectory, currentTimestep, setCurrentTimestep, updateAnalysisConfig]);

    useEffect(() => {
        if(!analysisConfig?._id) return;
        computeTimestepData(trajectory, currentTimestep);
    }, [analysisConfig, trajectory, currentTimestep, computeTimestepData]);

    useEffect(() => {
        if(trajectory && currentTimestep !== undefined){
            computeTimestepData(trajectory, currentTimestep);
        }
    }, [trajectory, currentTimestep, computeTimestepData]);

    useEffect(() => {
        if(currentGlbUrl && lastRefreshTimestamp > 0){
            logger.log('GLB URLs updated:', {
                timestamp: lastRefreshTimestamp,
                trajectoryUrl: currentGlbUrl.trajectory,
                dislocationsUrl: currentGlbUrl.dislocations
            });
        }
    }, [currentGlbUrl, lastRefreshTimestamp, logger]);

    const coordinatedPlayNextFrame = useCallback(() => {
        if(timestepData.timesteps?.length > 0){
            playNextFrame(timestepData.timesteps);
        }
    }, [playNextFrame, timestepData.timesteps]);

    useEffect(() => {
        return () => {
            resetPlayback();
            resetTimestep();
            clearCurrentTrajectory();
        };
    }, [resetPlayback, resetTimestep, clearCurrentTrajectory]);
    
    return {
        trajectory,
        currentTimestep,
        timestepData,
        currentGlbUrl,
        lastRefreshTimestamp,
        isLoading,
        error,
        trajectoryId,
        setCurrentTimestep,
        coordinatedPlayNextFrame
    };
};

export default useCanvasCoordinator;