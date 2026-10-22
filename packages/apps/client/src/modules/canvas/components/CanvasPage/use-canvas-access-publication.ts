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
            canCollaborate: canMutate
        });
    }, [access, trajectoryId, setAccess]);

    useEffect(() => resetAccess, [resetAccess]);

    const canMutateCanvas = isLocalGlbViewer || Boolean(access?.hasTeamMembership);

    return {
        canCollaborate,
        canMutateCanvas
    };
};

export default useCanvasAccessPublication;
