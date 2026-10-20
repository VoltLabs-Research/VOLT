import useExpressionEvaluator from './use-expression-evaluator';
import type { GetAtomsResponse } from '@/modules/trajectory/api/services/trajectory-service';

interface UseExpressionSelectResult {
    matchCount: number | null;
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
            isValid,
            error,
            autoRoute
        };
    }

    let matchCount = 0;
    for (let i = 0; i < evaluatedColumn.length; i++) {
        matchCount += evaluatedColumn[i] !== 0 ? 1 : 0;
    }

    return {
        matchCount,
        isValid: true,
        autoRoute: false
    };
};

export default useExpressionSelect;
