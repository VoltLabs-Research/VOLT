import { AvatarFallback, AvatarImage, AvatarRoot, cn } from '@heroui/react';
import { getInitialsFromUser } from '@/shared/utils/user';

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

    return (
        <AvatarRoot
            className='relative shrink-0 overflow-hidden rounded-full bg-surface-tertiary text-muted size-8'
        >
            {user?.avatar && <AvatarImage src={user.avatar} alt={altText} className='object-cover' />}
            <AvatarFallback
                className='bg-surface-tertiary font-semibold text-muted text-xs'
            >
                {initials}
            </AvatarFallback>

            {showStatus && (
                <span
                    className={cn(
                        'absolute right-0 bottom-0 size-2 rounded-full ring-2 ring-surface-secondary',
                        isOnline ? 'bg-success' : 'bg-muted'
                    )}
                />
            )}
        </AvatarRoot>
    );
};

export default UserAvatar;
