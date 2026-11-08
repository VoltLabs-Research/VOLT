import { ExpressionError, parse } from '@voltstack/expressions';
import { useMemo } from 'react';
import { compileExpression } from '@/modules/canvas/utils/compile-expression';
import { createExpressionAtomContext } from '@/modules/canvas/utils/expression-atom-context';
import type { GetAtomsResponse } from '@/modules/trajectory/api/services/trajectory-service';

interface UseExpressionSelectResult {
    matchCount: number | null;
    isValid: boolean;
    error?: string;
    autoRoute: boolean;
}

const toMessage = (error: unknown): string => (
    error instanceof ExpressionError ? error.message : String(error)
);

const useExpressionSelect = (
    expression: string,
    atomBuffer: GetAtomsResponse | null | undefined,
    frameIndex = 0,
    cellVolume = 0
): UseExpressionSelectResult => useMemo(() => {
    if (!expression.trim() || !atomBuffer) {
        return {
            matchCount: null,
            isValid: false,
            autoRoute: false
        };
    }

    // The frame has more atoms than the browser reads; only the syntax can be checked here.
    if (atomBuffer.total > atomBuffer.count) {
        try {
            parse(expression);
        } catch (error) {
            return {
                matchCount: null,
                isValid: false,
                error: toMessage(error),
                autoRoute: false
            };
        }
        return {
            matchCount: null,
            isValid: true,
            autoRoute: true
        };
    }

    try {
        const context = createExpressionAtomContext(atomBuffer, frameIndex, cellVolume);
        return {
            matchCount: compileExpression(expression, context).select().count,
            isValid: true,
            autoRoute: false
        };
    } catch (error) {
        return {
            matchCount: null,
            isValid: false,
            error: toMessage(error),
            autoRoute: false
        };
    }
}, [expression, atomBuffer, frameIndex, cellVolume]);

export default useExpressionSelect;
