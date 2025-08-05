import { useEffect, useCallback } from 'react';
import usePlaybackStore from '@/stores/editor/playback';
import useTimestepStore from '@/stores/editor/timesteps';
import useTrajectoryStore from '@/stores/trajectories';

const useEditorCoordinator = () => {
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const currentTimestep = usePlaybackStore((state) => state.currentTimestep);
    const setCurrentTimestep = usePlaybackStore((state) => state.setCurrentTimestep);
    const computeTimestepData = useTimestepStore((state) => state.computeTimestepData);
    const timestepData = useTimestepStore((state) => state.timestepData);
    const playNextFrame = usePlaybackStore((state) => state.playNextFrame);

    // Sincronizar datos de timesteps cuando cambie la trayectoria
    useEffect(() => {
        computeTimestepData(trajectory, currentTimestep);
    }, [trajectory, currentTimestep, computeTimestepData]);

    // Coordinar playback con timesteps disponibles
    const coordinatedPlayNextFrame = useCallback(() => {
        playNextFrame(timestepData.timesteps);
    }, [playNextFrame, timestepData.timesteps]);

    // Manejar selección de trayectoria
    const handleTrajectorySelection = useCallback((newTrajectory: any) => {
        if (newTrajectory?.frames?.length > 0) {
            const firstTimestep = newTrajectory.frames
                .map((frame: any) => frame.timestep)
                .sort((a: number, b: number) => a - b)[0];
            
            setCurrentTimestep(firstTimestep);
        }
    }, [setCurrentTimestep]);

    return {
        trajectory,
        currentTimestep,
        timestepData,
        setCurrentTimestep,
        handleTrajectorySelection,
        coordinatedPlayNextFrame,
    };
};

export default useTrajectoryStore;