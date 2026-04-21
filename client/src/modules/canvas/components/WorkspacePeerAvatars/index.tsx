import Avatar from '@/shared/presentation/components/Avatar';
import Tooltip from '@/shared/presentation/components/Tooltip';

import type { WorkspacePresenceUser } from '@/modules/canvas/collaboration/use-canvas-workspace';
import type { User } from '@/modules/auth/api/entities/user';

import './WorkspacePeerAvatars.css';

interface WorkspacePeerAvatarsProps {
    peers: WorkspacePresenceUser[];
    self?: WorkspacePresenceUser;
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

const renderAvatarButton = (
    user: WorkspacePresenceUser,
    options: {
        isActive: boolean;
        isSelf: boolean;
        onClick: () => void;
    }
) => {
    const fullName = resolveFullName(user);
    const label = options.isSelf ? `${fullName} (you)` : fullName;
    const classes = ['workspace-peer-avatar-button'];
    if (options.isActive) classes.push('is-active');
    if (options.isSelf) classes.push('is-self');

    return (
        <Tooltip key={user.id} content={label} placement='bottom'>
            <button
                type='button'
                className={classes.join(' ')}
                onClick={options.onClick}
                aria-label={options.isSelf ? 'Go to your workspace' : `Open ${fullName} workspace`}
            >
                <Avatar
                    user={{
                        _id: user.id,
                        email: user.email ?? '',
                        firstName: user.firstName,
                        lastName: user.lastName,
                        avatar: user.avatar
                    } as User}
                    size='xs'
                />
            </button>
        </Tooltip>
    );
};

const WorkspacePeerAvatars = ({
    peers,
    self,
    activeOwnerId,
    onSelectPeer,
    maxDisplay = 4
}: WorkspacePeerAvatarsProps) => {
    if (peers.length === 0 && !self) {
        return null;
    }

    const visible = peers.slice(0, maxDisplay);
    const overflow = peers.length - visible.length;

    return (
        <div className='volt-container workspace-peer-avatars d-flex items-center gap-025'>
            {self && renderAvatarButton(self, {
                isActive: self.id === activeOwnerId,
                isSelf: true,
                onClick: () => onSelectPeer(self.id)
            })}
            {visible.map((peer) => renderAvatarButton(peer, {
                isActive: peer.id === activeOwnerId,
                isSelf: false,
                onClick: () => onSelectPeer(peer.id)
            }))}
            {overflow > 0 && (
                <div className='volt-container workspace-peer-overflow avatar avatar-xs d-flex flex-center radius-full'>
                    <span className='font-weight-6 font-size-05'>+{overflow}</span>
                </div>
            )}
        </div>
    );
};

export default WorkspacePeerAvatars;
