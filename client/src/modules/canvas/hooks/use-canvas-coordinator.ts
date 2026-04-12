import {
    extractTrajectoryTimesteps,
    getNearestTimestep,
    getSelectedTimestepsForAnalysis
} from '../utilities/selected-timestep-analysis';
import { findCachedAnalysisById } from '@/modules/analysis/services/cache';
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
        resetModel,
        resetPlayback
    } = useEditorStore(useShallow((state) => ({
        currentTimestep: state.currentTimestep,
        setCurrentTimestep: state.setCurrentTimestep,
        resetModel: state.resetModel,
        resetPlayback: state.resetPlayback
    })));

    const analyses = useMemo(() => {
        return analysesQuery.data?.data ?? [];
    }, [analysesQuery.data]);

    const trajectoryTimesteps = useMemo(() => extractTrajectoryTimesteps(trajectory), [trajectory]);
    const selectedAnalysis = useMemo(() => {
        if (!analysisId) {
            return undefined;
        }

        return findCachedAnalysisById({
            analysisId,
            trajectoryId,
            fallbackAnalyses: analyses.length > 0 ? analyses : (trajectory?.analysis ?? [])
        });
    }, [analyses, analysisId, trajectory?.analysis, trajectoryId]);
    const selectedAnalysisTimesteps = useMemo(() => {
        return getSelectedTimestepsForAnalysis(selectedAnalysis, trajectoryTimesteps);
    }, [selectedAnalysis, trajectoryTimesteps]);
    const availableTimesteps = selectedAnalysisTimesteps ?? trajectoryTimesteps;
    const timelineScopeKey = useMemo(() => {
        return [
            trajectory?._id ?? trajectoryId ?? 'no-trajectory',
            analysisId ?? 'no-analysis',
            availableTimesteps.join(',')
        ].join('|');
    }, [trajectory?._id, trajectoryId, analysisId, availableTimesteps]);
    const resolvedCurrentTimestep = getNearestTimestep(currentTimestep, availableTimesteps);
    const isAwaitingSelectedAnalysis = Boolean(analysisId && analysesQuery.isLoading && !selectedAnalysis);
    const previousTimelineScopeKeyRef = useRef<string>('');

    useEffect(() => {
        if (isAwaitingSelectedAnalysis || previousTimelineScopeKeyRef.current === timelineScopeKey) {
            return;
        }

        previousTimelineScopeKeyRef.current = timelineScopeKey;
        resetPlayback();
    }, [isAwaitingSelectedAnalysis, timelineScopeKey, resetPlayback]);

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
        if (trajectory?._id && trajectory.status) {
            if (trajectory.status === 'completed' && prevTrajectoryStatusRef.current !== 'completed') {
                resetModel();
            }

            prevTrajectoryStatusRef.current = trajectory.status;
        }
    }, [trajectory?._id, trajectory?.status, resetModel]);

    return {
        trajectory,
        availableTimesteps,
        currentTimestep: resolvedCurrentTimestep,
        isLoading,
        error
    };
};

export default useCanvasCoordinator;
