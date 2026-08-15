import { parse, evaluate, ExpressionError } from '@voltstack/expressions';
import { useMemo } from 'react';
import type { GetAtomsResponse, AtomColumnView } from '@/modules/trajectory/api/services/trajectory-service';
import type { AtomContext, ColumnView, DType } from '@voltstack/expressions';

const CLIENT_EVAL_ATOM_LIMIT = 1_000_000;

const toDType = (d: AtomColumnView['dtype']): DType => {
    if (d === 'f32') return 'f32';
    if (d === 'i32') return 'i32';
    if (d === 'u32') return 'u32';
    if (d === 'u16') return 'u16';
    return 'str';
};

const toColumnView = (col: AtomColumnView): ColumnView => ({
    values: col.values,
    dtype: toDType(col.dtype)
});

const buildContext = (
    atomBuffer: GetAtomsResponse,
    frameIndex: number,
    cellVolume: number
): AtomContext => ({
    N: atomBuffer.count,
    Frame: frameIndex,
    CellVolume: cellVolume,
    getColumn: (name: string) => {
        const col = atomBuffer.getColumn(name);
        return col ? toColumnView(col) : undefined;
    }
});

interface UseExpressionEvaluatorResult {
    isValid: boolean;
    error?: string;
    evaluatedColumn?: Float64Array;
    autoRoute: boolean;
}

const useExpressionEvaluator = (
    formula: string,
    atomBuffer: GetAtomsResponse | null | undefined,
    frameIndex = 0,
    cellVolume = 0
): UseExpressionEvaluatorResult => {
    return useMemo(() => {
        if (!formula.trim() || !atomBuffer) {
            return {
                isValid: false,
                autoRoute: false
            };
        }

        if (atomBuffer.count > CLIENT_EVAL_ATOM_LIMIT) {
            return {
                isValid: true,
                autoRoute: true
            };
        }

        let ast;
        try {
            ast = parse(formula);
        } catch (e) {
            const msg = e instanceof ExpressionError ? e.message : String(e);
            return {
                isValid: false,
                error: msg,
                autoRoute: false
            };
        }

        const context = buildContext(atomBuffer, frameIndex, cellVolume);
        const result = new Float64Array(atomBuffer.count);

        try {
            for (let i = 0; i < atomBuffer.count; i++) {
                result[i] = evaluate(ast, context, i);
            }
        } catch (e) {
            const msg = e instanceof ExpressionError ? e.message : String(e);
            return {
                isValid: false,
                error: msg,
                autoRoute: false
            };
        }

        return {
            isValid: true,
            evaluatedColumn: result,
            autoRoute: false
        };
    }, [formula, atomBuffer, frameIndex, cellVolume]);
};

export default useExpressionEvaluator;
