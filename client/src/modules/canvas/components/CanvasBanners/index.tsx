import { Users } from 'lucide-react';
import type { WorkspacePresenceUser } from '@/modules/canvas/collaboration/use-canvas-workspace';

interface CanvasBannersProps {
    collaborationOwner?: WorkspacePresenceUser;
    isWorkspaceOwner: boolean;
    onLeaveCollaboration?: () => void;
}

const formatPeerName = (peer: WorkspacePresenceUser): string => {
    const trimmedFirst = peer.firstName?.trim();
    const trimmedLast = peer.lastName?.trim();
    if (trimmedFirst || trimmedLast) {
        return [trimmedFirst, trimmedLast].filter(Boolean).join(' ');
    }
    if (peer.email) {
        return peer.email;
    }
    return 'another user';
};

const CanvasBanners = ({
    collaborationOwner,
    isWorkspaceOwner,
    onLeaveCollaboration
}: CanvasBannersProps) => {
    const showCollabBanner = Boolean(collaborationOwner) && !isWorkspaceOwner;

    if (!showCollabBanner) {
        return null;
    }

    return (
        <div className='canvas-banner-stack d-flex column' role='region' aria-label='Canvas notifications'>
            {showCollabBanner && collaborationOwner && (
                <div className='canvas-banner canvas-banner--collab d-flex items-center' role='status'>
                    <span className='canvas-banner__icon' aria-hidden='true'>
                        <Users size={14} />
                    </span>
                    <span className='canvas-banner__message'>
                        You are viewing <strong>{formatPeerName(collaborationOwner)}</strong>'s session.
                        Changes are broadcast live — scene edits go to their viewport.
                    </span>
                    {onLeaveCollaboration && (
                        <span className='canvas-banner__actions'>
                            <button
                                type='button'
                                className='canvas-banner__close'
                                onClick={onLeaveCollaboration}
                                aria-label='Leave session and return to your workspace'
                                title='Leave session'
                            >
                                Leave
                            </button>
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default CanvasBanners;
