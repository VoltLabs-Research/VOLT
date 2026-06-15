import useExpressionEvaluator from './use-expression-evaluator';
import type { GetAtomsOutputDTO } from '@/modules/trajectory/api/services/trajectory-service';

export interface UseExpressionSelectResult {
    matchCount: number | null;
    visibilityMask: Uint8Array | null;
    isValid: boolean;
    error?: string;
    autoRoute: boolean;
}

/**
 * Produces a per-atom boolean visibility mask from a boolean expression.
 * Delegates evaluation to useExpressionEvaluator; the mask is 1 for atoms
 * where the expression is truthy (non-zero), 0 otherwise.
 */
const useExpressionSelect = (
    expression: string,
    atomBuffer: GetAtomsOutputDTO | null | undefined,
    frameIndex?: number,
    cellVolume?: number
): UseExpressionSelectResult => {
    const { isValid, error, evaluatedColumn, autoRoute } = useExpressionEvaluator(
        expression,
        atomBuffer,
        frameIndex,
        cellVolume
    );

    if (!isValid || !evaluatedColumn) {
        return { matchCount: null, visibilityMask: null, isValid, error, autoRoute };
    }

    const mask = new Uint8Array(evaluatedColumn.length);
    let matchCount = 0;
    for (let i = 0; i < evaluatedColumn.length; i++) {
        const v = evaluatedColumn[i] !== 0 ? 1 : 0;
        mask[i] = v;
        matchCount += v;
    }

    return { matchCount, visibilityMask: mask, isValid: true, autoRoute: false };
};

export default useExpressionSelect;
