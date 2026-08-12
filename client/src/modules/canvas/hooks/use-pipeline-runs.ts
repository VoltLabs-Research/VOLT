import { useCallback, useEffect, useMemo, useRef } from 'react';
import { sileo } from 'sileo';
import { usePipelineRunsQuery } from '@/modules/plugin/hooks/plugin/queries';
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
}

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
    expandSection
}: UsePipelineRunsProps) => {
    const mode = useCanvasAccessMode();
    const isRbac = mode !== 'public';
    const replaceStages = useCanvasPipelineStore((state) => state.replaceStages);

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

    return {
        runSections,
        // Restoring writes to the draft, so it follows the same gate as editing it.
        onRestoreRun: canMutateCanvas ? restoreRun : undefined
    };
};

export default usePipelineRuns;
