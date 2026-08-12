import { AvatarFallback, AvatarImage, AvatarRoot, cn } from '@heroui/react';
import { getInitialsFromUser } from '@/shared/utils/user';

export interface AvatarUser {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    avatar?: string | null;
};

export type UserAvatarSize = 'xs' | 'sm' | 'md' | 'lg';

interface UserAvatarProps {
    user?: AvatarUser | null;
    size?: UserAvatarSize;
    showStatus?: boolean;
    isOnline?: boolean;
    className?: string;
};

const SIZE_CLASS_NAMES: Record<UserAvatarSize, string> = {
    xs: 'size-6',
    sm: 'size-8',
    md: 'size-10',
    lg: 'size-14'
};

const INITIALS_CLASS_NAMES: Record<UserAvatarSize, string> = {
    xs: 'text-2xs',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-lg'
};

const UserAvatar = ({
    user,
    size = 'md',
    showStatus = false,
    isOnline = false,
    className
}: UserAvatarProps) => {
    const initials = user ? getInitialsFromUser(user) : '?';
    const altText = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'Avatar';

    return (
        <AvatarRoot
            className={cn(
                'relative shrink-0 overflow-hidden rounded-full bg-surface-tertiary text-muted',
                SIZE_CLASS_NAMES[size],
                className
            )}
        >
            {user?.avatar && <AvatarImage src={user.avatar} alt={altText} className='object-cover' />}
            <AvatarFallback
                className={cn('bg-surface-tertiary font-semibold text-muted', INITIALS_CLASS_NAMES[size])}
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
