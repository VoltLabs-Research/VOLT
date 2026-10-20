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

const toExpressionStageConfig = (stage: PipelineRunStage): ExpressionSelectStageConfig => {
    const stored = typeof stage.config.expression === 'string' ? stage.config.expression : '';
    const match = NEGATED_EXPRESSION.exec(stored.trim());

    return {
        expression: match ? match[1] : stored,
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
