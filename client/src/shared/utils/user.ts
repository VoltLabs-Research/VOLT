

import { getCategoricalColor } from '@/shared/ui/utils/categorical-palette';

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

/*
 * Delegates to the shared categorical palette instead of keeping its own five hues and its own
 * hash. The old hash summed char codes, which ignores position and so collided across similar
 * addresses; the shared one is position-sensitive.
 */
export const getAvatarColorFromString = (str: string): string => getCategoricalColor(str);
