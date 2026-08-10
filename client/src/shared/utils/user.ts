/**
 * User-display helpers, relocated verbatim from bravais when that package was
 * retired.
 *
 * The avatar palette stays coloured on purpose. VOLT's accent is monochrome, but
 * an avatar is imagery rather than an accent: the hue identifies a person, it
 * never sits under body text or on a control, so it is outside that rule.
 */

/** Minimal user-like shape needed to derive initials — structural, so this
 *  helper carries no domain (auth) dependency. */
interface InitialsUserSource {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
}

export const getInitialsFromUser = (user: InitialsUserSource | string | null | undefined): string => {
    if(!user || typeof user === 'string') return '?';

    if(user.firstName && user.lastName){
        return (user.firstName[0] + user.lastName[0]).toUpperCase();
    }

    if(user.email){
        const parts = user.email.split('@')[0].split('.');
        if(parts.length >= 2){
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return user.email[0].toUpperCase();
    }

    return '?';
};

export const getInitialsFromEmail = (email: string): string => {
    if(!email) return '?';
    return email.split('@')[0].charAt(0).toUpperCase();
};

const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];

export const getAvatarColorFromString = (str: string): string => {
    if(!str) return AVATAR_COLORS[0];
    const hash = str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};
