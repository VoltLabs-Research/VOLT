import { v4 } from 'uuid';

export type GuestUser = {
    id: string;
    firstName: string;
    color: string;
};

const ANIMALS = [
    'Axolotl',
    'Panda',
    'Red Panda',
    'Koala',,
    'Otter',
    'Dolphin',
    'Fox',
    'Hedgehog',
    'Llama',
    'Sloth',
    'Toucan',
    'Capybara',
    'Quokka',
    'Narwhal',
    'Octopus',
    'Penguin',
    'Raccoon',
    'Tiger',
    'Turtle',
    'Whale',
];

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

const pickAnimal = (uid: string) => {
    const idx = hash('animal:' + uid) % ANIMALS.length;
    const animal = ANIMALS[idx];
    return { name: animal };
};

export const getOrCreateGuestUser = (): GuestUser => {
    let uid = localStorage.getItem(GUEST_KEY);
    if(!uid){
        uid = v4().slice(0, 12);
        localStorage.setItem(GUEST_KEY, uid);
    }

    const animal = pickAnimal(uid);
    return {
        id: 'guest:' + uid,
        firstName: `${animal.name}`,
        color: hslFromUid(uid)
    }
};

export const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase() || '?';
};
