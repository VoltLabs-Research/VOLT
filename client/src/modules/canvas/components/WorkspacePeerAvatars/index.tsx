import { Avatar, Box, IconButton, Row, Text, Tooltip } from '@voltstack/bravais';

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
            <IconButton
                variant='ghost'
                size='sm'
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
            </IconButton>
        </Tooltip>
    );
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
        <Row gap='025' className='workspace-peer-avatars'>
            {visible.map((peer) => renderAvatarButton(peer, {
                isActive: peer.id === activeOwnerId,
                isSelf: false,
                onClick: () => onSelectPeer(peer.id)
            }))}
            {overflow > 0 && (
                <Box display='flex' radius='full' className='workspace-peer-overflow avatar avatar-xs flex-center'>
                    <Text as='span' size='xs' weight='bold'>+{overflow}</Text>
                </Box>
            )}
        </Row>
    );
};

export default WorkspacePeerAvatars;
