import { Button } from '@heroui/react';
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
    if (!collaborationOwner || isWorkspaceOwner) {
        return null;
    }

    return (
        <div className='z-[4] mb-2 ml-[max(0.5rem,env(safe-area-inset-left,0px))] mr-2 flex flex-row items-center gap-3 rounded-2xl bg-foreground/[0.08] py-2 pl-3.5 pr-2 text-sm leading-[1.35] text-foreground' role='status' aria-label='Canvas notifications'>
            <span className='min-w-0 flex-1'>
                You are viewing <strong>{formatPeerName(collaborationOwner)}</strong>'s session.
                Changes are broadcast live — scene edits go to their viewport.
            </span>
            {onLeaveCollaboration && (
                <Button
                    variant='ghost'
                    size='sm'
                    className='shrink-0'
                    onPress={onLeaveCollaboration}
                    aria-label='Leave session and return to your workspace'
                >
                    Leave
                </Button>
            )}
        </div>
    );
};

export default CanvasBanners;
