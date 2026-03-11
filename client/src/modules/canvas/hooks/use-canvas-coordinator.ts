import {
    extractTrajectoryTimesteps,
    getNearestTimestep,
    getSelectedTimestepsForAnalysis
} from '../utilities/selected-timestep-analysis';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import useCanvasUrlState from './use-canvas-url-state';
import useGetTrajectoryById from '@/modules/trajectory/hooks/trajectory/use-get-trajectory-by-id';
import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';
import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

const useCanvasCoordinator = ({ trajectoryId }: { trajectoryId?: string }) => {
    const { analysisId } = useCanvasUrlState();
    const { trajectory, isLoading, error } = useGetTrajectoryById({
        trajectoryId,
        enabled: !!trajectoryId
    });
    const analysesQuery = useAnalysesByTrajectoryQuery(
        { trajectoryId: trajectoryId ?? '', page: 1, limit: 100 },
        { enabled: !!trajectoryId }
    );

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

    const analyses = useMemo(() => {
        return analysesQuery.data?.data ?? [];
    }, [analysesQuery.data]);

    const trajectoryTimesteps = useMemo(() => extractTrajectoryTimesteps(trajectory), [trajectory]);
    const selectedAnalysis = useMemo(() => {
        if (!analysisId) {
            return undefined;
        }

        return analyses.find((analysis) => analysis._id === analysisId);
    }, [analyses, analysisId]);
    const selectedAnalysisTimesteps = useMemo(() => {
        return getSelectedTimestepsForAnalysis(selectedAnalysis, trajectoryTimesteps);
    }, [selectedAnalysis, trajectoryTimesteps]);
    const visibleTimesteps = selectedAnalysisTimesteps ?? trajectoryTimesteps;
    const resolvedCurrentTimestep = getNearestTimestep(currentTimestep, visibleTimesteps);
    const isAwaitingSelectedAnalysis = Boolean(analysisId && analysesQuery.isLoading && analyses.length === 0);

    useEffect(() => {
        if (!trajectory || isAwaitingSelectedAnalysis) {
            return;
        }

        if (resolvedCurrentTimestep === undefined || resolvedCurrentTimestep === currentTimestep) {
            return;
        }

        setCurrentTimestep(resolvedCurrentTimestep);
    }, [trajectory, isAwaitingSelectedAnalysis, resolvedCurrentTimestep, currentTimestep, setCurrentTimestep]);

    const prevTrajectoryStatusRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        let recomputeTimeoutId: number | null = null;

        if (trajectory?._id && trajectory.status) {
            if (trajectory.status === 'completed' && prevTrajectoryStatusRef.current !== 'completed') {
                resetModel();

                if (resolvedCurrentTimestep !== undefined && !isAwaitingSelectedAnalysis) {
                    recomputeTimeoutId = window.setTimeout(() => {
                        computeTimestepData(trajectory, resolvedCurrentTimestep, Date.now(), selectedAnalysisTimesteps);
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
    }, [
        trajectory,
        trajectory?.status,
        trajectory?._id,
        resolvedCurrentTimestep,
        computeTimestepData,
        isAwaitingSelectedAnalysis,
        resetModel,
        selectedAnalysisTimesteps
    ]);

    useEffect(() => {
        if (!trajectory?._id || isAwaitingSelectedAnalysis) {
            return;
        }

        computeTimestepData(trajectory, resolvedCurrentTimestep, undefined, selectedAnalysisTimesteps);
    }, [trajectory, computeTimestepData, isAwaitingSelectedAnalysis, resolvedCurrentTimestep, selectedAnalysisTimesteps]);

    return {
        trajectory,
        currentTimestep: resolvedCurrentTimestep,
        timestepData,
        activeModel,
        isLoading,
        error,
        trajectoryId
    };
};

export default useCanvasCoordinator;
