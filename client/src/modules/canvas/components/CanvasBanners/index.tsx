import { Users } from 'lucide-react';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
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
        <Stack className='canvas-banner-stack' role='region' aria-label='Canvas notifications'>
            {showCollabBanner && collaborationOwner && (
                <Row className='canvas-banner canvas-banner--collab' role='status'>
                    <Text as='span' className='canvas-banner__icon' aria-hidden='true'>
                        <Users size={14} />
                    </Text>
                    <Text as='span' className='canvas-banner__message'>
                        You are viewing <strong>{formatPeerName(collaborationOwner)}</strong>'s session.
                        Changes are broadcast live — scene edits go to their viewport.
                    </Text>
                    {onLeaveCollaboration && (
                        <Text as='span' className='canvas-banner__actions'>
                            <button
                                type='button'
                                className='canvas-banner__close'
                                onClick={onLeaveCollaboration}
                                aria-label='Leave session and return to your workspace'
                                title='Leave session'
                            >
                                Leave
                            </button>
                        </Text>
                    )}
                </Row>
            )}
        </Stack>
    );
};

export default CanvasBanners;
