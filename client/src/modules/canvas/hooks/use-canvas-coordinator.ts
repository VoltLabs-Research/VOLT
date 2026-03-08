import { useEditorStore } from '@/modules/canvas/stores/editor';

import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import useGetTrajectoryById from '@/modules/trajectory/hooks/trajectory/use-get-trajectory-by-id';

const useCanvasCoordinator = ({ trajectoryId }: { trajectoryId?: string }) => {
    const { trajectory, isLoading, error } = useGetTrajectoryById({
        trajectoryId,
        enabled: !!trajectoryId
    });

    const {
        currentTimestep,
        setCurrentTimestep,
        computeTimestepData,
        timestepData,
        activeModel,
        resetModel
    } = useEditorStore(useShallow((state) => ({
        currentTimestep: state.currentTimestep,
        setCurrentTimestep: state.setCurrentTimestep,
        computeTimestepData: state.computeTimestepData,
        timestepData: state.timestepData,
        activeModel: state.activeModel,
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
        let recomputeTimeoutId: number | null = null;

        if (trajectory?._id && trajectory.status) {
            if (trajectory.status === 'completed' && prevTrajectoryStatusRef.current !== 'completed') {
                resetModel();

                if (currentTimestep !== undefined) {
                    recomputeTimeoutId = window.setTimeout(() => {
                        computeTimestepData(trajectory, currentTimestep, Date.now());
                    }, 100);
                }
            }
            prevTrajectoryStatusRef.current = trajectory.status;
        }

        return () => {
            if (recomputeTimeoutId !== null) {
                window.clearTimeout(recomputeTimeoutId);
            }
        };
    }, [trajectory?.status, trajectory?._id, currentTimestep, computeTimestepData, resetModel]);

    useEffect(() => {
        if (trajectory?._id && currentTimestep !== undefined) {
            computeTimestepData(trajectory, currentTimestep);
        }
    }, [trajectory?._id, currentTimestep, computeTimestepData]);

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
