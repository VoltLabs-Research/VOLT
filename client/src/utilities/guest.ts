import { v4 } from 'uuid';
import authApi from '@/services/api/auth';

// TODO: CHECK FOR DUPLICATED CODE
export type GuestUser = {
    id: string;
    firstName: string;
    color: string;
};

const GUEST_KEY = 'guest_uid_v1';

const hash = (str: string): number => {
    let h = 2166136261 >>> 0;
    for(let i = 0; i < str.length; i++){
        h ^= str.charCodeAt(i);
        // FNV-1a
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
};

const hslFromUid = (uid: string) => {
    const h = hash(uid) % 360;
    const s = 62;
    const l = 58;
    return `hsl(${h} ${s}% ${l}%)`;
};

export const getOrCreateGuestUser = async(): Promise<GuestUser> =>{
    let uid = localStorage.getItem(GUEST_KEY);
    if(!uid){
        uid = v4().slice(0, 12);
        localStorage.setItem(GUEST_KEY, uid);
    }

    // Try to get cached name first
    const cachedName = localStorage.getItem(`${GUEST_KEY}_name`);

    if(cachedName){
        return {
            id: 'guest:' + uid,
            firstName: cachedName,
            color: hslFromUid(uid)
        };
    }

    const user = await authApi.getGuestIdentity(uid);
    const firstName = (user as any).firstName || 'Guest';

    // Cache the name
    localStorage.setItem(`${GUEST_KEY}_name`, firstName);

    return {
        id: 'guest:' + uid,
        firstName,
        color: hslFromUid(uid)
    };
};

export const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase() || '?';
};
