import { AvatarFallback, AvatarImage, AvatarRoot, cn } from '@heroui/react';
import { getInitialsFromUser } from '@/shared/utils/user';
import type { ReactNode } from 'react';

/**
 * bravais's `Avatar`, rebuilt on HeroUI's three-part avatar.
 *
 * It lives in this module rather than in `shared/ui` because chat is the only
 * consumer left; the five call sites here (this file, ChatAvatar, MessageBubble,
 * MemberListItem, TeamMemberList) are all that remain of it. If another module
 * ends up needing the same thing, this is the file to promote.
 *
 * Same props, same precedence (`icon` → image → initials), same 24/32/40/56px
 * sizes and the same initials type scale, which bravais set through a descendant
 * selector (`.avatar-xs .avatar-initials`) and is expressed here as one class per
 * size so nothing depends on a stylesheet.
 *
 * One deliberate difference: bravais had no `onError` on the image, so a 404
 * avatar URL rendered a broken-image glyph forever. Radix's `Avatar.Image`
 * reports its load status and `Avatar.Fallback` takes over, so initials appear
 * instead.
 */
export interface AvatarUser {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    avatar?: string | null;
};

export type UserAvatarSize = 'xs' | 'sm' | 'md' | 'lg';

interface UserAvatarProps {
    user?: AvatarUser | null;
    icon?: ReactNode;
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
    xs: 'text-[0.625rem]',
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-[1.125rem]'
};

const UserAvatar = ({
    user,
    icon,
    size = 'md',
    showStatus = false,
    isOnline = false,
    className
}: UserAvatarProps) => {
    const imageSrc = user?.avatar;
    const initials = user ? getInitialsFromUser(user) : '?';
    const altText = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'Avatar';

    return (
        <AvatarRoot
            className={cn(
                'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-tertiary text-muted',
                SIZE_CLASS_NAMES[size],
                className
            )}
        >
            {icon ? (
                <span className='flex size-full items-center justify-center'>
                    {icon}
                </span>
            ) : (
                <>
                    {imageSrc && (
                        <AvatarImage
                            src={imageSrc}
                            alt={altText}
                            className='size-full object-cover'
                        />
                    )}
                    <AvatarFallback
                        className={cn(
                            'flex size-full items-center justify-center bg-transparent font-semibold',
                            INITIALS_CLASS_NAMES[size]
                        )}
                    >
                        {initials}
                    </AvatarFallback>
                </>
            )}

            {showStatus && (
                <span
                    className={cn(
                        'absolute bottom-0 right-0 size-2 shrink-0 rounded-full shadow-[0_0_0_2px_var(--surface-secondary)]',
                        isOnline ? 'bg-success' : 'bg-muted'
                    )}
                    role='status'
                    aria-label={isOnline ? 'success status' : 'neutral status'}
                />
            )}
        </AvatarRoot>
    );
};

export default UserAvatar;
