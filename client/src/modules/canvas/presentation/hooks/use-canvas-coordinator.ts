import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import useGetTrajectoryById from '@/modules/trajectory/presentation/hooks/trajectory/use-get-trajectory-by-id';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';

const useCanvasCoordinator = ({ trajectoryId }: { trajectoryId?: string }) => {
    const { trajectory, isLoading, error } = useGetTrajectoryById({
        trajectoryId,
        enabled: !!trajectoryId
    });
    const setTrajectory = useTrajectoryStore((state) => state.setTrajectory);

    const {
        currentTimestep,
        setCurrentTimestep,
        resetPlayback,
        computeTimestepData,
        timestepData,
        activeModel,
        resetTimesteps,
        resetModel
    } = useEditorStore(useShallow((state) => ({
        currentTimestep: state.currentTimestep,
        setCurrentTimestep: state.setCurrentTimestep,
        resetPlayback: state.resetPlayback,
        computeTimestepData: state.computeTimestepData,
        timestepData: state.timestepData,
        activeModel: state.activeModel,
        resetTimesteps: state.resetTimesteps,
        resetModel: state.resetModel
    })));

    useEffect(() => {
        if (!trajectory || currentTimestep !== undefined) return;

        if (!trajectory.frames || trajectory.frames.length === 0) {
            return;
        }

        const timesteps = trajectory.frames
            .map((frame: any) => frame.timestep)
            .filter((ts: any) => ts !== undefined && ts !== null);

        if (timesteps.length > 0) {
            const firstTimestep = Math.min(...timesteps);
            setCurrentTimestep(firstTimestep);

        }
    }, [trajectory, currentTimestep, setCurrentTimestep]);

    const prevTrajectoryStatusRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (trajectory?._id && trajectory.status) {
            if (trajectory.status === 'completed' && prevTrajectoryStatusRef.current !== 'completed') {
                resetModel();

                if (currentTimestep !== undefined) {
                    setTimeout(() => {
                        computeTimestepData(trajectory, currentTimestep, Date.now());
                    }, 100);
                }
            }
            prevTrajectoryStatusRef.current = trajectory.status;
        }
    }, [trajectory?.status, trajectory?._id, currentTimestep, computeTimestepData, resetModel]);

    useEffect(() => {
        if (trajectory?._id && currentTimestep !== undefined) {
            computeTimestepData(trajectory, currentTimestep);
        }
    }, [trajectory?._id, currentTimestep, computeTimestepData]);

    useEffect(() => {
        return () => {
            resetPlayback();
            resetTimesteps();
            setTrajectory(null);
        };
    }, [resetPlayback, resetTimesteps, setTrajectory]);

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
