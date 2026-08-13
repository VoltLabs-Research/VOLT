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
import { useCanvasPipelineStore } from '@/modules/canvas/store/canvas-pipeline';
import { buildPipelineRunSections } from '../utils/pipeline-run-sections';
import { toDraftStages } from '../utils/pipeline-run-restore';

import type { AnalysisSectionData } from '../utils/sidebar-scene-sections';
import type { PipelineRun } from '@volt/contracts/modules/plugin/pipeline-run';

const RUNS_PAGE_LIMIT = 50;

const EMPTY_RUNS: PipelineRun[] = [];

interface UsePipelineRunsProps {
    trajectoryId?: string;
    canMutateCanvas?: boolean;
    sections: AnalysisSectionData[];
    expandedSections: Set<string>;
    expandSection: (id: string) => void;
    /**
     * Clears the scenes, selection and section state pointing at one analysis.
     * Deleting a run deletes its analyses on the server, and the viewport would
     * otherwise keep a deleted result selected and try to load its GLB.
     */
    applyDeletedAnalysisLocally?: (analysisId: string) => void;
}

/**
 * The analyses a run produced, which are the ones its deletion takes with it.
 *
 * A cached stage is skipped: it stores its result under `cachedFromAnalysisId`,
 * pointing at an analysis an earlier run computed and still owns. Only `analysisId`
 * is this run's to delete — the server draws the same line, from
 * `Analysis.pipelineRunId`.
 */
const collectOwnedAnalysisIds = (run: PipelineRun): string[] => run.stages
    .map((stage) => stage.analysisId)
    .filter((analysisId): analysisId is string => Boolean(analysisId));

/**
 * Run history for the scene tree: fetches the runs, groups the analysis rows
 * under them, and restores a past run into the editable draft.
 *
 * Runs are only fetched in RBAC mode — the public/shared canvas has no runs
 * endpoint. An empty list is a supported state, not an error: the tree then
 * renders every analysis in one ungrouped section.
 */
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
    const replaceStages = useCanvasPipelineStore((state) => state.replaceStages);
    const renameMutation = useUpdatePipelineRunMutation();
    const deleteMutation = useDeletePipelineRunMutation();

    const { data } = usePipelineRunsQuery(
        {
            trajectoryId: trajectoryId ?? '',
            page: 1,
            limit: RUNS_PAGE_LIMIT
        },
        { enabled: isRbac && !!trajectoryId }
    );

    const pipelineRuns = data?.data ?? EMPTY_RUNS;

    const runSections = useMemo(
        () => buildPipelineRunSections({
            sections,
            runs: pipelineRuns
        }),
        [sections, pipelineRuns]
    );

    // Collapsed-by-default would read as "my results are gone", so the newest run
    // opens once per trajectory. Holding the trajectory id rather than a flag is
    // what makes it once *per trajectory* and re-arms on a switch; re-expanding on
    // every refetch would fight the user each time a job status arrives.
    const autoExpandedTrajectoryRef = useRef<string | undefined>(undefined);
    const newestRunId = runSections[0]?.runId;

    useEffect(() => {
        if (!trajectoryId || newestRunId === undefined) return;
        if (autoExpandedTrajectoryRef.current === trajectoryId) return;

        autoExpandedTrajectoryRef.current = trajectoryId;
        if (!expandedSections.has(newestRunId)) {
            expandSection(newestRunId);
        }
    }, [trajectoryId, newestRunId, expandedSections, expandSection]);

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

    /*
     * No success toast: the new name appears in the row that was just edited, so a
     * toast would only repeat what the user is already looking at. A failure has no
     * such tell — the row silently snaps back on refetch — so that one is surfaced.
     */
    const renameRun = useCallback(async (run: PipelineRun, name: string) => {
        if (!trajectoryId) return;

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
    }, [renameMutation, trajectoryId]);

    /*
     * Unlike the per-analysis delete, this is not optimistic. That one removes a
     * single known row and can snapshot exactly what to put back; a run takes an
     * unbounded set of analyses with it, so the cheap, honest version is to wait for
     * the server and then refetch. The local cleanup below is not an optimistic
     * update — it runs after success, and only to drop scenes that now point at
     * results the server has already deleted.
     */
    const deleteRun = useCallback(async (run: PipelineRun) => {
        if (!trajectoryId) return;

        const ownedAnalysisIds = collectOwnedAnalysisIds(run);

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
                    description: ownedAnalysisIds.length > 0
                        ? `${ownedAnalysisIds.length} analysis${ownedAnalysisIds.length === 1 ? '' : 'es'} removed with it.`
                        : undefined
                },
                error: { title: 'Failed to delete run' }
            }
        );
    }, [applyDeletedAnalysisLocally, deleteMutation, trajectoryId]);

    return {
        runSections,
        // Restoring writes to the draft, so it follows the same gate as editing it.
        onRestoreRun: canMutateCanvas ? restoreRun : undefined,
        onRenameRun: canMutateCanvas ? renameRun : undefined,
        onDeleteRun: canMutateCanvas ? deleteRun : undefined
    };
};

export default usePipelineRuns;
