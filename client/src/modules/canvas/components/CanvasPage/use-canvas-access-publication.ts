import { useCanvasAccessStore, useCanvasCanCollaborate } from '@/modules/canvas/api/access/use-canvas-access-store';
import { useEffect } from 'react';

import type { PublicCanvasAccess } from '@/modules/canvas/api/services/canvas-service';

interface CanvasAccessPublicationParams {
    trajectoryId: string;
    access: PublicCanvasAccess | null;
    isLocalGlbViewer: boolean;
}

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
