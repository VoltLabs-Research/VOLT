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

import { useEffect, useRef } from 'react';
import usePlaybackStore from '@/stores/editor/playback';
import useTimestepStore from '@/stores/editor/timesteps';
import useTrajectoryStore from '@/stores/trajectories';
import useLogger from '@/hooks/core/use-logger';
import useAnalysisConfigStore from '@/stores/analysis-config';
import useModelStore from '@/stores/editor/model';

const useCanvasCoordinator = ({ trajectoryId }: { trajectoryId: string }) => {
    const logger = useLogger('use-canvas-coordinator');
    // Create a ref for throttling logs
    const lastLogTimeRef = useRef(0);

    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const getTrajectoryById = useTrajectoryStore((state) => state.getTrajectoryById);
    const isLoading = useTrajectoryStore((state) => state.isLoading);
    const error = useTrajectoryStore((state) => state.error);
    const clearCurrentTrajectory = useTrajectoryStore((state) => state.clearCurrentTrajectory);
    const updateAnalysisConfig = useAnalysisConfigStore((state) => state.updateAnalysisConfig);
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);

    const currentTimestep = usePlaybackStore((state) => state.currentTimestep);
    const setCurrentTimestep = usePlaybackStore((state) => state.setCurrentTimestep);
    const resetPlayback = usePlaybackStore((state) => state.reset);

    const computeTimestepData = useTimestepStore((state) => state.computeTimestepData);
    const timestepData = useTimestepStore((state) => state.timestepData);
    const activeModel = useModelStore((state) => state.activeModel);
    const resetTimestep = useTimestepStore((state) => state.reset);

    const resetModel = useModelStore((state) => state.reset);

    // Load trajectory when hook is initialized
    useEffect(() => {
        if(trajectoryId && (!trajectory || trajectory?._id !== trajectoryId)){
            logger.log(`Loading trajectory with ID: ${trajectoryId}`);
            getTrajectoryById(trajectoryId);
        }
    }, [trajectoryId, isLoading, trajectory, getTrajectoryById]);

    // Handle automatically the selection for the first timestep when trajectory is loaded
    useEffect(() => {
        logger.log(`Canvas coordinator effect: trajectory=${!!trajectory}, currentTimestep=${currentTimestep}, frames=${trajectory?.frames?.length || 0}`);
        
        // Only run this effect if we have a trajectory but no current timestep
        if(!trajectory || currentTimestep !== undefined) return;
        
        // Make sure we have frames to work with
        if(!trajectory.frames || trajectory.frames.length === 0) {
            logger.log('No frames available in trajectory');
            return;
        }
        
        // Find the first timestep by sorting all available timesteps
        const frames = trajectory.frames || [];
        const timesteps = frames
            .map((frame: any) => frame.timestep)
            .filter((ts: any) => ts !== undefined && ts !== null);
            
        // Sort numerically to ensure we get the lowest value
        const sortedTimesteps = [...timesteps].sort((a: number, b: number) => a - b);
        
        if(sortedTimesteps.length > 0) {
            const firstTimestep = sortedTimesteps[0];
            logger.log(`Setting initial timestep: ${firstTimestep}`);
            setCurrentTimestep(firstTimestep);
            
            // If trajectory has analysis configs, then select the most recent
            if((trajectory.analysis ?? []).length >= 1){
                const config = trajectory.analysis[trajectory.analysis.length - 1];
                updateAnalysisConfig(config);
            }
        }
    }, [trajectory, currentTimestep, setCurrentTimestep, updateAnalysisConfig, logger]);

    // Separate effect for analysis config changes to avoid unnecessary re-renders
    useEffect(() => {
        if(trajectory?._id && currentTimestep !== undefined && analysisConfig?._id){
            // Reset model when analysis config changes to force reload
            resetModel();
            // Force recompute timestep data to reload GLB with new analysis config
            // Use a small delay to ensure model reset is processed first
            setTimeout(() => {
                computeTimestepData(trajectory, currentTimestep, Date.now());
            }, 50);
        }
    }, [analysisConfig?._id, trajectory?._id, currentTimestep, resetModel, computeTimestepData, trajectory]);

    // When trajectory.status changes to 'completed', force a GLB reload by resetting and recomputing
    useEffect(() => {
        if(trajectory?._id && currentTimestep !== undefined && trajectory.status === 'completed'){
            logger.log(`Trajectory rendering completed, forcing GLB reload for ${trajectory._id}`);
            // Reset model to clear cache
            resetModel();
            // Then recompute to reload the GLB with cache buster (timestamp to break cache)
            setTimeout(() => {
                computeTimestepData(trajectory, currentTimestep, Date.now());
            }, 100);
        }
    }, [trajectory?.status, trajectory?._id, currentTimestep, computeTimestepData, resetModel, logger]);

    useEffect(() => {
        // Throttle console logging to avoid excessive rendering and console spam
        const now = Date.now();
        
        // Only log every 1000ms to avoid flooding the console
        if (now - lastLogTimeRef.current > 1000) {
            lastLogTimeRef.current = now;
        }
        
        if(trajectory?._id && currentTimestep !== undefined){
            // Only log when computing, which is less frequent than render cycles
            computeTimestepData(trajectory, currentTimestep);
        }
    }, [trajectory?._id, currentTimestep, computeTimestepData]);

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
        activeModel,
        isLoading,
        error,
        trajectoryId
    };
};

export default useCanvasCoordinator;