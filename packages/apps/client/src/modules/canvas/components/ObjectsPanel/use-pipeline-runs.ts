import { useCallback, useEffect, useMemo, useRef } from 'react';
import { sileo } from 'sileo';
import { ErrorSurface } from '@/shared/contracts/errors';
import { reportError } from '@/shared/errors/core/report-error';
import { analysisQuery } from '@/modules/analysis/hooks/queries';
import { invalidateSceneArtifacts } from '@/modules/trajectory/hooks/scene-artifacts/queries';
import { showPromise } from '@/shared/ui/hooks/toast';
import {
    useDeletePipelineRunMutation,
    usePipelineRunsQuery,
    useUpdatePipelineRunMutation
} from '@/modules/plugin/hooks/plugin/queries';
import { useCanvasAccessMode } from '@/modules/canvas/api/access/use-canvas-access-store';
import { isWasmLocalTrajectoryId } from '@/modules/canvas-wasm/constants';
import { useWasmCanvasStore } from '@/modules/canvas-wasm/store';
import { useCanvasPipelineStore } from '@/modules/canvas/store/canvas-pipeline';
import { buildPipelineRunSections } from '../../utils/pipeline-run-sections';
import { toDraftStages } from '../../utils/pipeline-run-restore';

import type { AnalysisSectionData } from '../../utils/sidebar-scene-sections';
import type { PipelineRun } from '@volt/contracts/modules/plugin/pipeline-run';

const RUNS_PAGE_LIMIT = 50;

const EMPTY_RUNS: PipelineRun[] = [];

interface UsePipelineRunsProps {
    trajectoryId?: string;
    canMutateCanvas?: boolean;
    sections: AnalysisSectionData[];
    expandedSections: Set<string>;
    expandSection: (id: string) => void;
    applyDeletedAnalysisLocally?: (analysisId: string) => void;
}

const collectOwnedAnalysisIds = (run: PipelineRun): string[] => run.stages
    .map((stage) => stage.analysisId)
    .filter((analysisId): analysisId is string => Boolean(analysisId));

const usePipelineRuns = ({
    trajectoryId,
    canMutateCanvas,
    sections,
    expandedSections,
    expandSection,
    applyDeletedAnalysisLocally
}: UsePipelineRunsProps) => {
    const mode = useCanvasAccessMode();
    const isRbac = mode !== 'public';
    // /canvas/wasm has no server: its runs live in the WASM store and are renamed/deleted there.
    const isWasm = isWasmLocalTrajectoryId(trajectoryId);
    const wasmRuns = useWasmCanvasStore((state) => state.pipelineRuns);
    const replaceStages = useCanvasPipelineStore((state) => state.replaceStages);
    const renameMutation = useUpdatePipelineRunMutation();
    const deleteMutation = useDeletePipelineRunMutation();

    const { data } = usePipelineRunsQuery(
        {
            trajectoryId: trajectoryId ?? '',
            page: 1,
            limit: RUNS_PAGE_LIMIT
        },
        { enabled: isRbac && !!trajectoryId && !isWasm }
    );

    const pipelineRuns = isWasm ? wasmRuns : data?.data ?? EMPTY_RUNS;

    const runSections = useMemo(
        () => buildPipelineRunSections({
            sections,
            runs: pipelineRuns
        }),
        [sections, pipelineRuns]
    );

    const autoExpandedKeyRef = useRef<string | undefined>(undefined);
    const newestRunId = runSections[0]?.runId;

    // The newest run opens once per trajectory; the WASM trajectory never changes, so there each
    // new run opens as it appears.
    useEffect(() => {
        if (!trajectoryId || newestRunId === undefined) return;
        const autoExpandKey = isWasm ? newestRunId : trajectoryId;
        if (autoExpandedKeyRef.current === autoExpandKey) return;

        autoExpandedKeyRef.current = autoExpandKey;
        if (!expandedSections.has(newestRunId)) {
            expandSection(newestRunId);
        }
    }, [trajectoryId, isWasm, newestRunId, expandedSections, expandSection]);

    const restoreRun = useCallback((run: PipelineRun) => {
        if (!trajectoryId) return;

        const stages = toDraftStages(run);
        if (stages.length === 0) {
            sileo.warning({
                title: 'Nothing to restore',
                description: 'This run has no stages that can be rebuilt.'
            });
            return;
        }

        replaceStages(stages, trajectoryId);
        sileo.success({
            title: 'Pipeline restored',
            description: `${stages.length} stage${stages.length === 1 ? '' : 's'} loaded into the pipeline. Run it to recompute.`
        });
    }, [replaceStages, trajectoryId]);

    const renameRun = useCallback(async (run: PipelineRun, name: string) => {
        if (!trajectoryId) return;
        if (isWasm) {
            useWasmCanvasStore.getState().renamePipelineRun(run._id, name);
            return;
        }

        try {
            await renameMutation.mutateAsync({
                trajectoryId,
                pipelineRunId: run._id,
                name
            });
        } catch (error: unknown) {
            reportError(error, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Failed to rename run'
            });
        }
    }, [isWasm, renameMutation, trajectoryId]);

    const deleteRun = useCallback(async (run: PipelineRun) => {
        if (!trajectoryId) return;

        const ownedAnalysisIds = collectOwnedAnalysisIds(run);
        const removedDescription = ownedAnalysisIds.length > 0
            ? `${ownedAnalysisIds.length} analysis${ownedAnalysisIds.length === 1 ? '' : 'es'} removed with it.`
            : undefined;

        if (isWasm) {
            ownedAnalysisIds.forEach((analysisId) => applyDeletedAnalysisLocally?.(analysisId));
            useWasmCanvasStore.getState().removePipelineRun(run._id);
            sileo.success({ title: 'Run deleted', description: removedDescription });
            return;
        }

        await showPromise(
            deleteMutation.mutateAsync({
                trajectoryId,
                pipelineRunId: run._id
            }).then(async () => {
                ownedAnalysisIds.forEach((analysisId) => {
                    applyDeletedAnalysisLocally?.(analysisId);
                });

                await Promise.all([
                    analysisQuery.cache.invalidate(),
                    invalidateSceneArtifacts()
                ]);
            }),
            {
                loading: { title: 'Deleting run...' },
                success: {
                    title: 'Run deleted',
                    description: removedDescription
                },
                error: { title: 'Failed to delete run' }
            }
        );
    }, [applyDeletedAnalysisLocally, deleteMutation, isWasm, trajectoryId]);

    return {
        runSections,
        onRestoreRun: canMutateCanvas ? restoreRun : undefined,
        onRenameRun: canMutateCanvas ? renameRun : undefined,
        onDeleteRun: canMutateCanvas ? deleteRun : undefined
    };
};

export default usePipelineRuns;
