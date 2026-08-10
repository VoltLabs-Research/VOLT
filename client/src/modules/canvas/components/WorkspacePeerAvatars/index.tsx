import { Avatar, cn } from '@heroui/react';
import { getInitialsFromUser } from '@/shared/utils/user';

import type { WorkspacePresenceUser } from '@/modules/canvas/collaboration/use-canvas-workspace';

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

/**
 * bravais's `Avatar size='xs'` was 1.5rem with 0.625rem initials, and the button
 * around it was a 2px transparent ring that turned `--color-primary` (the
 * foreground, under VOLT's monochrome accent) when that peer's workspace was the
 * one on screen. The button stays a plain `<button>` rather than a HeroUI one:
 * HeroUI's `Button` has no `title`, and its own padding/size variants would have to
 * be unset to get back to a bare 24px ring.
 */
const AVATAR_BUTTON_CLASS = 'cursor-pointer rounded-full border-2 border-transparent bg-transparent p-0 leading-none transition-colors duration-[120ms] ease-out';

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
    const initials = getInitialsFromUser({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
    });

    return (
        <button
            key={user.id}
            type='button'
            className={cn(
                AVATAR_BUTTON_CLASS,
                options.isActive && 'border-foreground',
                options.isSelf && 'shadow-[0_0_0_1px_var(--foreground)_inset]'
            )}
            onClick={options.onClick}
            title={label}
            aria-label={options.isSelf ? 'Go to your workspace' : `Open ${fullName} workspace`}
        >
            <Avatar className='size-6'>
                {user.avatar && <Avatar.Image src={user.avatar} alt={fullName} />}
                <Avatar.Fallback className='text-[0.625rem] font-semibold'>{initials}</Avatar.Fallback>
            </Avatar>
        </button>
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
        <div className='ml-2 flex h-full flex-row items-center gap-1 pl-2'>
            {visible.map((peer) => renderAvatarButton(peer, {
                isActive: peer.id === activeOwnerId,
                isSelf: false,
                onClick: () => onSelectPeer(peer.id)
            }))}
            {overflow > 0 && (
                <div className='ml-0.5 flex size-6 items-center justify-center overflow-hidden rounded-full bg-white/8 text-white/70'>
                    <span className='text-[0.625rem] font-semibold'>+{overflow}</span>
                </div>
            )}
        </div>
    );
};

export default WorkspacePeerAvatars;
