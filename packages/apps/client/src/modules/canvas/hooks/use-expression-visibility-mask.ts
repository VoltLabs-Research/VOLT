import { useMemo } from 'react';
import { useActivePipelineStages } from '@/modules/canvas/store/canvas-pipeline';
import { DEFAULT_EXPRESSION_SELECT_COLOR } from '@/modules/canvas/store/canvas-pipeline';
import useExpressionFrameAtoms from '@/modules/canvas/hooks/use-expression-frame-atoms';
import { compileExpression } from '@/modules/canvas/utils/compile-expression';
import { createExpressionAtomContext } from '@/modules/canvas/utils/expression-atom-context';
import type { AtomContext } from '@voltstack/expressions';
import type { ExpressionSelectStageConfig } from '@/modules/canvas/store/canvas-pipeline';

interface UseExpressionVisibilityMaskParams {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
}

interface UseExpressionVisibilityMaskResult {
    // Atoms a Delete stage keeps, or null when no stage deletes.
    mask: Uint8Array | null;
    // Atoms a Color stage selected, or null when no stage colours.
    highlightMask: Uint8Array | null;
    highlightColor: string | null;
    // The frame is too large to select in the browser.
    autoRoute: boolean;
}

interface ExpressionSelectStageView {
    expression: string;
    action: 'color' | 'delete';
    color: string;
}

const EMPTY: UseExpressionVisibilityMaskResult = {
    mask: null,
    highlightMask: null,
    highlightColor: null,
    autoRoute: false
};

// A stage whose expression does not compile, or fails on this frame, selects nothing.
const selectStage = (stage: ExpressionSelectStageView, context: AtomContext): Uint8Array | null => {
    try {
        return compileExpression(stage.expression, context).select().mask;
    } catch {
        return null;
    }
};

const useExpressionVisibilityMask = ({
    trajectoryId,
    analysisId,
    currentTimestep
}: UseExpressionVisibilityMaskParams): UseExpressionVisibilityMaskResult => {
    const stages = useActivePipelineStages(trajectoryId);

    const activeStages = useMemo<ExpressionSelectStageView[]>(() => {
        return stages
            .filter((s) => s.type === 'expression-select' && s.enabled)
            .map((s) => {
                const config = s.config as ExpressionSelectStageConfig;
                return {
                    expression: config.expression ?? '',
                    action: config.action === 'delete' ? 'delete' as const : 'color' as const,
                    color: config.color ?? DEFAULT_EXPRESSION_SELECT_COLOR
                };
            })
            .filter((s) => s.expression.trim().length > 0);
    }, [stages]);

    const { data: atomBuffer } = useExpressionFrameAtoms({
        trajectoryId,
        analysisId,
        timestep: currentTimestep,
        enabled: activeStages.length > 0
    });

    return useMemo<UseExpressionVisibilityMaskResult>(() => {
        if (activeStages.length === 0 || !atomBuffer) {
            return EMPTY;
        }
        if (atomBuffer.total > atomBuffer.count) {
            return {
                ...EMPTY,
                autoRoute: true
            };
        }

        const context = createExpressionAtomContext(atomBuffer, currentTimestep ?? 0);
        const count = atomBuffer.count;

        let deleteMask: Uint8Array | null = null;
        let highlightMask: Uint8Array | null = null;
        let highlightColor: string | null = null;

        for (const stage of activeStages) {
            const matched = selectStage(stage, context);
            if (!matched) continue;

            if (stage.action === 'delete') {
                if (!deleteMask) deleteMask = new Uint8Array(count).fill(1);
                for (let i = 0; i < count; i += 1) {
                    if (matched[i]) deleteMask[i] = 0;
                }
            } else {
                if (!highlightMask) highlightMask = new Uint8Array(count);
                for (let i = 0; i < count; i += 1) {
                    if (matched[i]) highlightMask[i] = 1;
                }
                highlightColor = stage.color;
            }
        }

        return {
            mask: deleteMask,
            highlightMask,
            highlightColor,
            autoRoute: false
        };
    }, [activeStages, atomBuffer, currentTimestep]);
};

export default useExpressionVisibilityMask;
