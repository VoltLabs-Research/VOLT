import type { AnalysisSectionData } from './sidebar-scene-sections';
import type { PipelineRun, PipelineRunStage } from '@volt/contracts/modules/plugin/pipeline-run';

export const UNGROUPED_RUN_ID = '__ungrouped__';

export type PipelineRunStageRow =
    | { kind: 'analysis'; key: string; stage?: PipelineRunStage; section: AnalysisSectionData; cacheHit: boolean }
    | { kind: 'context'; key: string; stage: PipelineRunStage }
    | { kind: 'unavailable'; key: string; stage: PipelineRunStage };

export interface PipelineRunSection {
    runId: string;
    run?: PipelineRun;
    rows: PipelineRunStageRow[];
    analysisSections: AnalysisSectionData[];
    isUngrouped: boolean;
}

const stageKey = (runId: string, stage: PipelineRunStage): string => `${runId}:${stage.index}`;

const resolveStageAnalysisId = (stage: PipelineRunStage): string | undefined =>
    stage.cacheHit ? stage.cachedFromAnalysisId : stage.analysisId;

const buildRunRows = (
    run: PipelineRun,
    sectionsByAnalysisId: Map<string, AnalysisSectionData>
): PipelineRunStageRow[] => {
    const orderedStages = [...run.stages].sort((left, right) => left.index - right.index);

    return orderedStages.map((stage): PipelineRunStageRow => {
        if (stage.kind !== 'plugin') {
            return {
                kind: 'context',
                key: stageKey(run._id, stage),
                stage
            };
        }

        const analysisId = resolveStageAnalysisId(stage);
        const section = analysisId ? sectionsByAnalysisId.get(analysisId) : undefined;

        if (!section) {
            return {
                kind: 'unavailable',
                key: stageKey(run._id, stage),
                stage
            };
        }

        return {
            kind: 'analysis',
            key: stageKey(run._id, stage),
            stage,
            section,
            cacheHit: stage.cacheHit
        };
    });
};

interface BuildPipelineRunSectionsInput {
    sections: AnalysisSectionData[];
    runs: PipelineRun[];
}

export const buildPipelineRunSections = ({
    sections,
    runs
}: BuildPipelineRunSectionsInput): PipelineRunSection[] => {
    const sectionsByAnalysisId = new Map(sections.map((section) => [section.analysis._id, section]));
    const knownRunIds = new Set(runs.map((run) => run._id));
    const groupedAnalysisIds = new Set<string>();
    const runSections: PipelineRunSection[] = [];

    runs.forEach((run) => {
        const rows = buildRunRows(run, sectionsByAnalysisId);
        const analysisSections = rows
            .filter((row): row is Extract<PipelineRunStageRow, { kind: 'analysis' }> => row.kind === 'analysis')
            .map((row) => row.section);

        if (analysisSections.length === 0) {
            return;
        }

        analysisSections.forEach((section) => {
            if (section.analysis.pipelineRunId === run._id) {
                groupedAnalysisIds.add(section.analysis._id);
            }
        });

        runSections.push({
            runId: run._id,
            run,
            rows,
            analysisSections,
            isUngrouped: false
        });
    });

    const ungroupedSections = sections.filter((section) => {
        const { pipelineRunId } = section.analysis;
        if (pipelineRunId !== undefined && knownRunIds.has(pipelineRunId)) {
            return !groupedAnalysisIds.has(section.analysis._id);
        }
        return true;
    });

    if (ungroupedSections.length === 0) {
        return runSections;
    }

    return [
        ...runSections,
        {
            runId: UNGROUPED_RUN_ID,
            rows: ungroupedSections.map((section) => ({
                kind: 'analysis' as const,
                key: `${UNGROUPED_RUN_ID}:${section.analysis._id}`,
                section,
                cacheHit: false
            })),
            analysisSections: ungroupedSections,
            isUngrouped: true
        }
    ];
};

export const countRunStagesByKind = (rows: PipelineRunStageRow[]): {
    analyses: number;
    context: number;
    cached: number;
} => ({
    analyses: rows.filter((row) => row.kind === 'analysis').length,
    context: rows.filter((row) => row.kind === 'context').length,
    cached: rows.filter((row) => row.kind === 'analysis' && row.cacheHit).length
});
