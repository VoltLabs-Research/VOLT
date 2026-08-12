import {
    DEFAULT_EXPRESSION_SELECT_COLOR,
    DEFAULT_SLICE_PLANE_STAGE_CONFIG
} from '../store/canvas-pipeline';

import type { NewStage } from '../store/canvas-pipeline';
import type {
    AnalysisPluginStageConfig,
    ExpressionSelectStageConfig,
    SlicePlaneStageConfig
} from '../store/canvas-pipeline';
import type { PipelineRun, PipelineRunStage } from '@volt/contracts/modules/plugin/pipeline-run';

const NEGATED_EXPRESSION = /^!\((.*)\)$/s;

/**
 * Undoes the negation the run control applies on submit.
 *
 * A `delete` expression stage is sent as `!(expr)` because the daemon *keeps*
 * what the expression matches, while the user wrote what they wanted removed.
 * Restoring the literal stored string would show the inverted expression in the
 * editor and, worse, negate it a second time on the next run.
 */
const toExpressionStageConfig = (stage: PipelineRunStage): ExpressionSelectStageConfig => {
    const stored = typeof stage.config.expression === 'string' ? stage.config.expression : '';
    const match = NEGATED_EXPRESSION.exec(stored.trim());

    return {
        expression: match ? match[1] : stored,
        // Only `delete` stages are ever submitted; `color` never leaves the client.
        action: 'delete',
        color: DEFAULT_EXPRESSION_SELECT_COLOR
    };
};

const toSliceStageConfig = (stage: PipelineRunStage): SlicePlaneStageConfig => ({
    ...DEFAULT_SLICE_PLANE_STAGE_CONFIG,
    ...(stage.config as Partial<SlicePlaneStageConfig>)
});

const toPluginStageConfig = (stage: PipelineRunStage): AnalysisPluginStageConfig => ({
    pluginId: stage.pluginId ?? '',
    argValues: stage.config
});

/**
 * Turns an executed run back into an editable draft, in submission order.
 *
 * Plugin stages missing a `pluginId` are dropped: the stage cannot be rebuilt
 * without one, and a stage that silently does nothing would be worse than an
 * absent one. Live-only stages (color coding, `color` expression selects) were
 * never part of the run, so a restored draft is the *computational* pipeline —
 * not a snapshot of how the viewport looked.
 */
export const toDraftStages = (run: PipelineRun): NewStage[] =>
    [...run.stages]
        .sort((left, right) => left.index - right.index)
        .flatMap((stage): NewStage[] => {
            if (stage.kind === 'slice') {
                return [{
                    type: 'slice-plane',
                    config: toSliceStageConfig(stage)
                }];
            }

            if (stage.kind === 'expression') {
                return [{
                    type: 'expression-select',
                    config: toExpressionStageConfig(stage)
                }];
            }

            if (!stage.pluginId) {
                return [];
            }

            return [{
                type: 'analysis-plugin',
                config: toPluginStageConfig(stage)
            }];
        });

export const countRestorableStages = (run: PipelineRun): number => toDraftStages(run).length;
