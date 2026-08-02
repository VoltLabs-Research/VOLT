import useCanvasWorkspace from '@/modules/canvas/collaboration/use-canvas-workspace';
import useLiveModelDrag from '@/modules/canvas/collaboration/use-live-model-drag';
import useWorkspaceCursors from '@/modules/canvas/collaboration/use-workspace-cursors';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import type { RefObject } from 'react';

interface CanvasCollaborationParams {
    trajectoryId: string;
    ownerId?: string;
    enabled: boolean;
    containerRef: RefObject<HTMLElement | null>;
}

/** Lobby/workspace presence, remote cursors and live model drags for the open canvas. */
const useCanvasCollaboration = ({
    trajectoryId,
    ownerId,
    enabled,
    containerRef
}: CanvasCollaborationParams) => {
    const navigate = useNavigate();
    const workspace = useCanvasWorkspace({
        trajectoryId,
        ownerId,
        enabled: enabled && !!trajectoryId
    });
    const sessionEnabled = enabled && !!trajectoryId && !!workspace.ownerId;

    const { cursors } = useWorkspaceCursors({
        trajectoryId,
        ownerId: workspace.ownerId,
        enabled: sessionEnabled,
        containerRef
    });

    useLiveModelDrag({
        trajectoryId,
        ownerId: workspace.ownerId,
        isOwner: workspace.isOwner,
        enabled: sessionEnabled
    });

    const leaveCollaboration = useCallback(() => {
        navigate(`/canvas/${trajectoryId}`, { replace: true });
    }, [navigate, trajectoryId]);

    return {
        ...workspace,
        cursors,
        leaveCollaboration
    };
};

export default useCanvasCollaboration;
