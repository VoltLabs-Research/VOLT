import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';
import { useCanvasPipelineStore, DEFAULT_EXPRESSION_SELECT_STAGE_CONFIG } from '@/modules/canvas/store/canvas-pipeline';
import { parse as parseExpression } from '@voltstack/expressions';

interface PushExpressionSelectInput {
    formula: string;
    description?: string;
}

const pushExpressionSelect: ClientToolHandler<PushExpressionSelectInput> = {
    name: 'push_expression_select',
    needsViewer: true,

    run(input): ClientToolResult {
        const formula = input.formula?.trim();
        if (!formula) {
            return {
                ok: false,
                summary: 'Formula is required.',
                reason: 'invalid_formula',
                hint: 'Provide a non-empty boolean expression, e.g. "Position.X > 10".'
            };
        }

        try {
            parseExpression(formula);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
                ok: false,
                summary: `Invalid expression: ${msg}`,
                reason: 'parse_error',
                hint: `Fix the expression syntax. Error: ${msg}`
            };
        }

        const stageId = useCanvasPipelineStore.getState().addStage('expression-select', { ...DEFAULT_EXPRESSION_SELECT_STAGE_CONFIG, expression: formula });
        if (!stageId) {
            return {
                ok: false,
                summary: 'No active trajectory to add the expression to.',
                reason: 'no_active_trajectory',
                hint: 'Open a trajectory in the canvas before pushing an expression select.'
            };
        }

        return {
            ok: true,
            summary: `Expression select pushed: "${formula}"`
        };
    },

    describeEffect(input, result) {
        if (!result.ok) return { label: 'Expression select unavailable', icon: 'filter' };
        return { label: `Expression: ${input.formula}`, icon: 'filter' };
    }
};

export default pushExpressionSelect;
