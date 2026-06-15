import { useMemo } from 'react';
import { trajectoryAtomsQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import type { AtomColumnView, GetAtomsOutputDTO } from '@/modules/trajectory/api/services/trajectory-service';

interface UseAtomsBufferParams {
    trajectoryId?: string;
    analysisId?: string;
    timestep?: number;
    enabled?: boolean;
}

interface UseAtomsBufferResult {
    data: GetAtomsOutputDTO | undefined;
    /**
     * The `id` column as a typed view, in GLB-vertex order (row `i` ↔ vertex `i`
     * before the engine's morton sort). `null` until the frame loads or when the
     * frame carries no `id` column.
     */
    ids: AtomColumnView['values'] | null;
    count: number;
    isLoading: boolean;
    /**
     * True when the frame exceeds the in-memory selection cap. Click picking is
     * unaffected (it reads one index back from the GPU), but lasso/box, which
     * project every atom to screen, are disabled — the caller surfaces the
     * "refine in the Analyze panel" affordance (plan risk #2).
     */
    exceedsSelectionCap: boolean;
}

// One-page fetch of the whole frame so atom index → id resolves without paging.
// Shares the trajectory-atoms query cache with the other full-frame consumers.
const FULL_FRAME_LIMIT = 50_000_000;

// Above this atom count, projecting every atom to screen on each lasso/box drag
// frame is infeasible (plan risk #2). Click picking stays available.
const LASSO_BOX_ATOM_CAP = 1_000_000;

const EMPTY: Pick<UseAtomsBufferResult, 'ids' | 'count' | 'exceedsSelectionCap'> = {
    ids: null,
    count: 0,
    exceedsSelectionCap: false
};

/**
 * Shared zero-copy access to a frame's atom columns for the selection feature.
 * Returns the `id` column view (GLB-vertex order) used to map a picked vertex
 * index — or a lasso/box hit — to the frame-stable atom id the store keys on.
 *
 * Both the 3D pick hook and the highlight effect read through this hook so they
 * see the same buffer (one fetch, cached by TanStack Query) rather than each
 * decoding the payload independently.
 */
const useAtomsBuffer = ({
    trajectoryId,
    analysisId,
    timestep,
    enabled = true
}: UseAtomsBufferParams): UseAtomsBufferResult => {
    const queryEnabled = enabled && !!trajectoryId && timestep !== undefined;

    const { data, isLoading } = trajectoryAtomsQuery(
        {
            trajectoryId: trajectoryId!,
            analysisId,
            timestep: timestep!,
            page: 1,
            limit: FULL_FRAME_LIMIT
        },
        { enabled: queryEnabled }
    );

    const derived = useMemo(() => {
        const idColumn = data?.getColumn('id');
        if (!idColumn) return EMPTY;
        const count = idColumn.values.length;
        return {
            ids: idColumn.values,
            count,
            exceedsSelectionCap: count > LASSO_BOX_ATOM_CAP
        };
    }, [data]);

    return { data, isLoading, ...derived };
};

export default useAtomsBuffer;
