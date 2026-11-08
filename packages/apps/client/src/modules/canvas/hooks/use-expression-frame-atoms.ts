import { trajectoryAtomsQuery } from '@/modules/trajectory/hooks/trajectory/queries';

// Frames up to this size are selected in the browser; larger ones are left to the daemon.
export const EXPRESSION_ATOM_LIMIT = 1_000_000;

interface UseExpressionFrameAtomsParams {
    trajectoryId?: string;
    analysisId?: string;
    timestep?: number;
    enabled?: boolean;
}

// Every atom of the frame, in one request that the stage editor's live count and the applied
// selection share: both ask with the same key, so the frame is fetched once and kept, since a
// frame's atoms do not change.
const useExpressionFrameAtoms = ({
    trajectoryId,
    analysisId,
    timestep,
    enabled = true
}: UseExpressionFrameAtomsParams) => trajectoryAtomsQuery(
    {
        trajectoryId: trajectoryId ?? '',
        analysisId: analysisId && analysisId !== 'default' ? analysisId : undefined,
        timestep: timestep ?? 0,
        page: 1,
        limit: EXPRESSION_ATOM_LIMIT
    },
    {
        enabled: enabled && Boolean(trajectoryId) && timestep !== undefined,
        staleTime: Infinity
    }
);

export default useExpressionFrameAtoms;
