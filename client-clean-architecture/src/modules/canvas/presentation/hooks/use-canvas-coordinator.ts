import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import useGetTrajectoryById from '@/modules/trajectory/presentation/hooks/trajectory/use-get-trajectory-by-id';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import useAnalysisConfigStore from '@/modules/canvas/presentation/stores/use-analysis-config-store';

const useCanvasCoordinator = ({ trajectoryId }: { trajectoryId?: string }) => {
    const lastLogTimeRef = useRef(0);

    const { trajectory, isLoading, error } = useGetTrajectoryById({
        trajectoryId,
        enabled: !!trajectoryId
    });
    const setTrajectory = useTrajectoryStore((state) => state.setTrajectory);

    const updateAnalysisConfig = useAnalysisConfigStore((state) => state.updateAnalysisConfig);
    const analysisConfig = useAnalysisConfigStore((state) => state.analysisConfig);

    const currentTimestep = useEditorStore((state) => state.currentTimestep);
    const setCurrentTimestep = useEditorStore((state) => state.setCurrentTimestep);
    const resetPlayback = useEditorStore((state) => state.resetPlayback);

    const computeTimestepData = useEditorStore((state) => state.computeTimestepData);
    const timestepData = useEditorStore((state) => state.timestepData);
    const activeModel = useEditorStore((state) => state.activeModel);
    const resetTimestep = useEditorStore((state) => state.resetTimesteps);

    const resetModel = useEditorStore((state) => state.resetModel);

    useEffect(() => {
        if (!trajectory || currentTimestep !== undefined) return;

        if (!trajectory.frames || trajectory.frames.length === 0) {
            return;
        }

        const frames = trajectory.frames || [];
        const timesteps = frames
            .map((frame: any) => frame.timestep)
            .filter((ts: any) => ts !== undefined && ts !== null);

        const sortedTimesteps = [...timesteps].sort((a: number, b: number) => a - b);

        if (sortedTimesteps.length > 0) {
            const firstTimestep = sortedTimesteps[0];
            setCurrentTimestep(firstTimestep);

            if ((trajectory.analysis ?? []).length >= 1) {
                const config = trajectory.analysis[trajectory.analysis.length - 1] as any;
                updateAnalysisConfig(config);
            }
        }
    }, [trajectory, currentTimestep, setCurrentTimestep, updateAnalysisConfig]);

    const prevAnalysisIdRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        if (trajectory?._id && currentTimestep !== undefined && analysisConfig?._id) {
            if (analysisConfig._id !== prevAnalysisIdRef.current) {
                prevAnalysisIdRef.current = analysisConfig._id;

                resetModel();

                setTimeout(() => {
                    computeTimestepData(trajectory, currentTimestep, Date.now());
                }, 50);
            }
        }
    }, [analysisConfig?._id, trajectory?._id, currentTimestep, resetModel, computeTimestepData, trajectory]);

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
        const now = Date.now();
        if (now - lastLogTimeRef.current > 1000) {
            lastLogTimeRef.current = now;
        }

        if (trajectory?._id && currentTimestep !== undefined) {
            computeTimestepData(trajectory, currentTimestep);
        }
    }, [trajectory?._id, currentTimestep, computeTimestepData]);

    useEffect(() => {
        return () => {
            resetPlayback();
            resetTimestep();
            setTrajectory(null);
        };
    }, [resetPlayback, resetTimestep, setTrajectory]);

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
