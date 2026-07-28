import { parse, evaluate } from '@voltstack/expressions';
import { useMemo } from 'react';
import { useStages } from '@/modules/canvas/store/canvas-pipeline';
import { trajectoryAtomsQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import { DEFAULT_EXPRESSION_SELECT_COLOR } from '@/modules/canvas/store/canvas-pipeline';
import type { GetAtomsResponse, AtomColumnView } from '@/modules/trajectory/api/services/trajectory-service';
import type { AtomContext, ColumnView, DType, Expr } from '@voltstack/expressions';
import type { ExpressionSelectStageConfig } from '@/modules/canvas/store/canvas-pipeline';

const CLIENT_EVAL_ATOM_LIMIT = 1_000_000;

const FULL_FRAME_LIMIT = 50_000_000;

interface UseExpressionVisibilityMaskParams {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
}

export interface UseExpressionVisibilityMaskResult {
    
    
    mask: Uint8Array | null;
    
    
    highlightMask: Uint8Array | null;
    
    highlightColor: string | null;
    
    
    autoRoute: boolean;
}

interface ExpressionSelectStageView {
    expression: string;
    action: 'color' | 'delete';
    color: string;
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

const buildContext = (atomBuffer: GetAtomsResponse, frameIndex: number): AtomContext => {
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

const EMPTY: UseExpressionVisibilityMaskResult = {
    mask: null,
    highlightMask: null,
    highlightColor: null,
    autoRoute: false
};

const useExpressionVisibilityMask = ({
    trajectoryId,
    analysisId,
    currentTimestep
}: UseExpressionVisibilityMaskParams): UseExpressionVisibilityMaskResult => {
    const stages = useStages(trajectoryId);

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

    const queryEnabled = activeStages.length > 0
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
        if (activeStages.length === 0 || !atomBuffer) {
            return EMPTY;
        }
        if (atomBuffer.count > CLIENT_EVAL_ATOM_LIMIT) {
            return {
                ...EMPTY,
                autoRoute: true
            };
        }

        const context = buildContext(atomBuffer, currentTimestep ?? 0);
        const count = atomBuffer.count;

        let deleteMask: Uint8Array | null = null;
        let highlightMask: Uint8Array | null = null;
        let highlightColor: string | null = null;

        const evalStage = (stage: ExpressionSelectStageView): Uint8Array | null => {
            let ast: Expr;
            try {
                ast = parse(stage.expression);
            } catch {
                return null;
            }
            const matched = new Uint8Array(count);
            try {
                for (let i = 0; i < count; i += 1) {
                    matched[i] = evaluate(ast, context, i) !== 0 ? 1 : 0;
                }
            } catch {
                return null;
            }
            return matched;
        };

        for (const stage of activeStages) {
            const matched = evalStage(stage);
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
