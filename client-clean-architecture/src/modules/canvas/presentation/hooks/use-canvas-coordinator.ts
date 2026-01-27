import { useEffect, useRef } from 'react';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import { useTrajectory } from '@/modules/trajectory/presentation/hooks/use-trajectory-queries';
import useLogger from '@/shared/presentation/hooks/core/use-logger';
import { useAnalysisStore } from '@/modules/analysis/presentation/stores';
import { InitializeTrajectoryUseCase } from '@/modules/canvas/application/use-cases/InitializeTrajectoryUseCase';
import { HandleAnalysisChangeUseCase } from '@/modules/canvas/application/use-cases/HandleAnalysisChangeUseCase';

const initializeTrajectoryUseCase = new InitializeTrajectoryUseCase();
const handleAnalysisChangeUseCase = new HandleAnalysisChangeUseCase();

const useCanvasCoordinator = ({ trajectoryId }: { trajectoryId?: string }) => {
    const logger = useLogger('use-canvas-coordinator');
    const lastLogTimeRef = useRef(0);

    const { data: trajectory, isLoading, error } = useTrajectory(trajectoryId!, 'frames,team');
    
    const updateAnalysisConfig = useAnalysisStore((state: any) => state.updateAnalysisConfig);
    const analysisConfig = useAnalysisStore((state: any) => state.analysisConfig);

    const currentTimestep = useEditorStore((state: any) => state.currentTimestep);
    const setCurrentTimestep = useEditorStore((state: any) => state.setCurrentTimestep);
    const resetPlayback = useEditorStore((state: any) => state.resetPlayback);

    const computeTimestepData = useEditorStore((state: any) => state.computeTimestepData);
    const activeModel = useEditorStore((state: any) => state.activeModel);
    const resetTimestep = useEditorStore((state: any) => state.resetTimesteps);
    const resetModel = useEditorStore((state: any) => state.resetModel);
    const timestepData = useEditorStore((state: any) => state.timestepData);

    // Initial load logic delegated to Use Case
    useEffect(() => {
        if (!trajectory || currentTimestep !== undefined) return;

        const { initialTimestep, initialAnalysisConfig } = initializeTrajectoryUseCase.execute({ 
            trajectory: trajectory as any 
        });

        if (initialTimestep !== undefined) {
            setCurrentTimestep(initialTimestep);
        }

        if (initialAnalysisConfig) {
            updateAnalysisConfig(initialAnalysisConfig);
        }
    }, [trajectory, currentTimestep, setCurrentTimestep, updateAnalysisConfig, logger]);

    const prevAnalysisIdRef = useRef<string | undefined>(undefined);

    // Analysis change logic delegated to Use Case
    useEffect(() => {
        const { shouldResetModel, shouldRecomputeData, timestamp } = handleAnalysisChangeUseCase.execute({
            analysisId: analysisConfig?._id,
            previousAnalysisId: prevAnalysisIdRef.current,
            currentTimestep
        });

        if (shouldResetModel) {
            prevAnalysisIdRef.current = analysisConfig?._id;
            resetModel();
        }

        if (shouldRecomputeData && trajectory) {
            setTimeout(() => {
                computeTimestepData(trajectory as any, currentTimestep!, timestamp);
            }, 50);
        }
    }, [analysisConfig?._id, trajectory, currentTimestep, resetModel, computeTimestepData]);

    const prevTrajectoryStatusRef = useRef<string | undefined>(undefined);

    // Dynamic reload logic (status change)
    useEffect(() => {
        if (trajectory?._id && trajectory.status === 'completed' && prevTrajectoryStatusRef.current !== 'completed') {
            resetModel();
            if (currentTimestep !== undefined) {
                setTimeout(() => {
                    computeTimestepData(trajectory as any, currentTimestep, Date.now());
                }, 100);
            }
        }
        if (trajectory?.status) {
            prevTrajectoryStatusRef.current = trajectory.status;
        }
    }, [trajectory?.status, trajectory?._id, currentTimestep, computeTimestepData, resetModel, logger]);

    // Timestep data computation
    useEffect(() => {
        if (trajectory?._id && currentTimestep !== undefined) {
            computeTimestepData(trajectory as any, currentTimestep);
        }
    }, [trajectory?._id, currentTimestep, computeTimestepData]);

    useEffect(() => {
        return () => {
            resetPlayback();
            resetTimestep();
        };
    }, [resetPlayback, resetTimestep]);

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
