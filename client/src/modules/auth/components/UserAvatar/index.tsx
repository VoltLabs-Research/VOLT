import { AvatarFallback, AvatarImage, AvatarRoot, cn } from '@heroui/react';
import { getInitialsFromUser } from '@/shared/utils/user';

/**
 * bravais's `Avatar`, rebuilt on HeroUI's three-part avatar.
 *
 * It lives in this module rather than in `shared/ui` because auth sits below
 * everything else — the sign-in screen must not pull another feature module in —
 * and auth has only two call sites (UserInfo, UserMenuPopover's collapsed
 * trigger). The chat module reached the same conclusion independently and has a
 * superset of this file (it also carries an `icon` slot). Whichever of the two is
 * promoted to `shared/ui` first should absorb the other: the size scale, the
 * initials type scale and the prop names here are deliberately identical to
 * chat's, so promotion changes no call site.
 *
 * Same derivations as bravais: image from `user.avatar`, initials from
 * `getInitialsFromUser`, alt text from the name, a circular crop, and the corner
 * presence dot. The 24/32/40/56px sizes and their initials sizes were set by a
 * descendant selector (`.avatar-sm .avatar-initials`) and are one class per size
 * here so nothing depends on a stylesheet.
 *
 * One deliberate difference: bravais had no `onError` on the image, so a 404
 * avatar URL rendered a broken-image glyph forever. Radix's `Avatar.Image`
 * reports its load status and `Avatar.Fallback` takes over, so initials appear.
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
