import { useCanvasAccessStore, useCanvasCanCollaborate } from '@/modules/canvas/api/access';
import { useEffect } from 'react';

import type { PublicCanvasAccess } from '@/modules/canvas/api/services/canvas-service';

interface CanvasAccessPublicationParams {
    trajectoryId: string;
    access: PublicCanvasAccess | null;
    isLocalGlbViewer: boolean;
}

/**
 * Publishes the access resolved by the canvas bootstrap into the shared access
 * store (so data hooks pick the right transport) and exposes the capabilities
 * the page renders against.
 */
const useCanvasAccessPublication = ({
    trajectoryId,
    access,
    isLocalGlbViewer
}: CanvasAccessPublicationParams) => {
    const setAccess = useCanvasAccessStore((state) => state.setAccess);
    const resetAccess = useCanvasAccessStore((state) => state.reset);
    const canCollaborate = useCanvasCanCollaborate();

    useEffect(() => {
        if (!access || !trajectoryId) {
            return;
        }

        const canMutate = access.hasTeamMembership;

        setAccess({
            mode: canMutate ? 'rbac' : 'public',
            trajectoryId,
            canMutate,
            canCollaborate: canMutate,
            isGuest: !canMutate,
            hasTeamMembership: canMutate
        });
    }, [access, trajectoryId, setAccess]);

    useEffect(() => resetAccess, [resetAccess]);

    const hasResolvedAccess = isLocalGlbViewer || Boolean(access);
    const canMutateCanvas = isLocalGlbViewer || Boolean(access?.hasTeamMembership);

    return {
        canCollaborate,
        hasResolvedAccess,
        canMutateCanvas,
        isReadOnlyCanvas: !isLocalGlbViewer && hasResolvedAccess && !canMutateCanvas
    };
};

export default useCanvasAccessPublication;
