import useExpressionEvaluator from './use-expression-evaluator';
import type { GetAtomsResponse } from '@/modules/trajectory/api/services/trajectory-service';

interface UseExpressionSelectResult {
    matchCount: number | null;
    visibilityMask: Uint8Array | null;
    isValid: boolean;
    error?: string;
    autoRoute: boolean;
}

const useExpressionSelect = (
    expression: string,
    atomBuffer: GetAtomsResponse | null | undefined,
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
        return {
            matchCount: null,
            visibilityMask: null,
            isValid,
            error,
            autoRoute
        };
    }

    const mask = new Uint8Array(evaluatedColumn.length);
    let matchCount = 0;
    for (let i = 0; i < evaluatedColumn.length; i++) {
        const v = evaluatedColumn[i] !== 0 ? 1 : 0;
        mask[i] = v;
        matchCount += v;
    }

    return {
        matchCount,
        visibilityMask: mask,
        isValid: true,
        autoRoute: false
    };
};

export default useExpressionSelect;
