import Avatar from '@/shared/presentation/components/Avatar';
import Container from '@/shared/presentation/components/Container';
import Tooltip from '@/shared/presentation/components/Tooltip';

import type { WorkspacePresenceUser } from '@/modules/canvas/collaboration/use-canvas-workspace';
import type { User } from '@/modules/auth/api/entities/user';

import './WorkspacePeerAvatars.css';

interface WorkspacePeerAvatarsProps {
    peers: WorkspacePresenceUser[];
    activeOwnerId?: string;
    onSelectPeer: (peerId: string) => void;
    maxDisplay?: number;
}

const resolveFullName = (peer: WorkspacePresenceUser): string => {
    const parts = [peer.firstName, peer.lastName].filter(Boolean);
    if (parts.length > 0) {
        return parts.join(' ');
    }

    return peer.email ?? 'Peer';
};

const WorkspacePeerAvatars = ({
    peers,
    activeOwnerId,
    onSelectPeer,
    maxDisplay = 4
}: WorkspacePeerAvatarsProps) => {
    if (peers.length === 0) {
        return null;
    }

    const visible = peers.slice(0, maxDisplay);
    const overflow = peers.length - visible.length;

    return (
        <Container className='workspace-peer-avatars d-flex items-center gap-025'>
            {visible.map((peer) => {
                const fullName = resolveFullName(peer);
                const isActive = peer.id === activeOwnerId;

                return (
                    <Tooltip key={peer.id} content={fullName} placement='bottom'>
                        <button
                            type='button'
                            className={`workspace-peer-avatar-button${isActive ? ' is-active' : ''}`}
                            onClick={() => onSelectPeer(peer.id)}
                            aria-label={`Open ${fullName} workspace`}
                        >
                            <Avatar
                                user={{
                                    _id: peer.id,
                                    email: peer.email ?? '',
                                    firstName: peer.firstName,
                                    lastName: peer.lastName,
                                    avatar: peer.avatar
                                } as User}
                                size='xs'
                            />
                        </button>
                    </Tooltip>
                );
            })}
            {overflow > 0 && (
                <Container className='workspace-peer-overflow avatar avatar-xs d-flex flex-center radius-full'>
                    <span className='font-weight-6 font-size-05'>+{overflow}</span>
                </Container>
            )}
        </Container>
    );
};

export default WorkspacePeerAvatars;
