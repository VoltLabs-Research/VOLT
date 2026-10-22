import { AvatarFallback, AvatarImage, AvatarRoot, cn } from '@heroui/react';
import { getInitialsFromUser, resolveAvatarUrl } from '@/shared/utils/user';

interface AvatarUser {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    avatar?: string | null;
};

interface UserAvatarProps {
    user?: AvatarUser | null;
    showStatus?: boolean;
    isOnline?: boolean;
};

const UserAvatar = ({
    user,
    showStatus = false,
    isOnline = false
}: UserAvatarProps) => {
    const initials = user ? getInitialsFromUser(user) : '?';
    const altText = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'Avatar';
    const avatarSrc = resolveAvatarUrl(user?.avatar);

    return (
        <AvatarRoot
            className='relative size-8 shrink-0 overflow-hidden rounded-full bg-default text-foreground'
        >
            {avatarSrc && <AvatarImage src={avatarSrc} alt={altText} className='object-cover' />}
            <AvatarFallback
                className='bg-default text-xs font-medium text-foreground'
            >
                {initials}
            </AvatarFallback>

            {showStatus && (
                <span
                    className={cn(
                        'absolute right-0 bottom-0 size-2 rounded-full ring-2 ring-canvas',
                        isOnline ? 'bg-success' : 'bg-muted'
                    )}
                />
            )}
        </AvatarRoot>
    );
};

export default UserAvatar;
