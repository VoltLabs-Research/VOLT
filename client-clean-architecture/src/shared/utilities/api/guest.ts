import { v4 } from 'uuid';
import { authRepository } from '@/modules/auth/infrastructure';

export type GuestUser = {
    id: string;
    firstName: string;
    color: string;
};

const GUEST_KEY = 'guest_uid_v1';

export const hash = (str: string): number => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
};

export const hslFromUid = (uid: string): string => {
    const h = hash(uid) % 360;
    const s = 62;
    const l = 58;
    return `hsl(${h} ${s}% ${l}%)`;
};

export const generateColorsWorker = (uids: string[]): Record<string, string> => {
    const hashFn = (str: string): number => {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h >>> 0;
    };

    const result: Record<string, string> = {};
    for (const uid of uids) {
        const h = hashFn(uid) % 360;
        result[uid] = `hsl(${h} 62% 58%)`;
    }
    return result;
};

export const getOrCreateGuestUser = async (): Promise<GuestUser> => {
    let uid = localStorage.getItem(GUEST_KEY);
    if (!uid) {
        uid = v4().slice(0, 12);
        localStorage.setItem(GUEST_KEY, uid);
    }

    const cachedName = localStorage.getItem(`${GUEST_KEY}_name`);
    if (cachedName) {
        return {
            id: `guest:${uid}`,
            firstName: cachedName,
            color: hslFromUid(uid)
        };
    }

    const user = await authRepository.getGuestIdentity(uid);
    const firstName = (user as any).firstName || 'Guest';

    localStorage.setItem(`${GUEST_KEY}_name`, firstName);

    return {
        id: `guest:${uid}`,
        firstName,
        color: hslFromUid(uid)
    };
};

export const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase() || '?';
};
