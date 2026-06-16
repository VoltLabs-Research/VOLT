import { parse, evaluate } from '@voltstack/expressions';
import { useMemo } from 'react';
import { useStages } from '@/modules/canvas/stores/canvas-pipeline';
import { trajectoryAtomsQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import type { GetAtomsOutputDTO, AtomColumnView } from '@/modules/trajectory/api/services/trajectory-service';
import type { AtomContext, ColumnView, DType, Expr } from '@voltstack/expressions';
import type { ExpressionSelectStageConfig } from '@/modules/canvas/stores/canvas-pipeline';

const CLIENT_EVAL_ATOM_LIMIT = 1_000_000;

const FULL_FRAME_LIMIT = 50_000_000;

interface UseExpressionVisibilityMaskParams {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
}

export interface UseExpressionVisibilityMaskResult {
    mask: Uint8Array | null;
    autoRoute: boolean;
}

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

const buildContext = (atomBuffer: GetAtomsOutputDTO, frameIndex: number): AtomContext => {
    const columnCache = new Map<string, ColumnView | undefined>();
    return {
        N: atomBuffer.count,
        Frame: frameIndex,
        CellVolume: 0,
        getColumn: (name: string) => {
            if (columnCache.has(name)) {
                return columnCache.get(name);
            }
            const col = atomBuffer.getColumn(name);
            const view = col ? toColumnView(col) : undefined;
            columnCache.set(name, view);
            return view;
        }
    };
};

const EMPTY: UseExpressionVisibilityMaskResult = { mask: null, autoRoute: false };

/**
 * Derives a per-atom visibility mask from the enabled `expression-select`
 * modifiers in the instant-modifier stack. An atom is visible iff EVERY enabled
 * non-empty expression evaluates truthy for it (logical AND). Invalid
 * expressions are skipped (treated as no-op), never thrown.
 *
 * Returns { mask: null, autoRoute: false } when there are no active expressions
 * (engine resets to all-visible), or { mask: null, autoRoute: true } when the
 * frame exceeds CLIENT_EVAL_ATOM_LIMIT (caller falls back to the daemon path).
 */
const useExpressionVisibilityMask = ({
    trajectoryId,
    analysisId,
    currentTimestep
}: UseExpressionVisibilityMaskParams): UseExpressionVisibilityMaskResult => {
    const stages = useStages(trajectoryId);

    const expressions = useMemo(() => {
        return stages
            .filter((s) => s.type === 'expression-select' && s.enabled)
            .map((s) => (s.config as ExpressionSelectStageConfig).expression ?? '')
            .filter((expr) => expr.trim().length > 0);
    }, [stages]);

    const queryEnabled = expressions.length > 0
        && Boolean(trajectoryId)
        && currentTimestep !== undefined;

    const { data: atomBuffer } = trajectoryAtomsQuery(
        {
            trajectoryId: trajectoryId ?? '',
            analysisId,
            timestep: currentTimestep ?? 0,
            page: 1,
            limit: FULL_FRAME_LIMIT
        },
        { enabled: queryEnabled }
    );

    return useMemo<UseExpressionVisibilityMaskResult>(() => {
        if (expressions.length === 0) {
            return EMPTY;
        }
        if (!atomBuffer) {
            return EMPTY;
        }
        if (atomBuffer.count > CLIENT_EVAL_ATOM_LIMIT) {
            return { mask: null, autoRoute: true };
        }

        const asts: Expr[] = [];
        for (const expr of expressions) {
            try {
                asts.push(parse(expr));
            } catch {
            }
        }
        if (asts.length === 0) {
            return EMPTY;
        }

        const context = buildContext(atomBuffer, currentTimestep ?? 0);
        const count = atomBuffer.count;
        const mask = new Uint8Array(count).fill(1);

        for (const ast of asts) {
            try {
                for (let i = 0; i < count; i += 1) {
                    if (mask[i] === 0) continue;
                    if (evaluate(ast, context, i) === 0) {
                        mask[i] = 0;
                    }
                }
            } catch {
            }
        }

        return { mask, autoRoute: false };
    }, [expressions, atomBuffer, currentTimestep]);
};

export default useExpressionVisibilityMask;
