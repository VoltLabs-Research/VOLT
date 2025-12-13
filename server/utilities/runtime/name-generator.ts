import crypto from 'crypto';

const ANIMALS = [
    'Axolotl',
    'Panda',
    'Red Panda',
    'Koala',
    'Otter',
    'Dolphin',
    'The Fox',
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

const hash = (str: string): number => {
    let h = 2166136261 >>> 0;
    for(let i = 0; i < str.length; i++){
        h ^= str.charCodeAt(i);
        // FNV-1a
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
};

/**
 * Generate a random first and last name based on an animal
 * @param seed Optional seed string(e.g. OAuth profile ID)
 * @returns Object containing firstName and lastName
 */
export const generateRandomName = (seed?: string): { firstName: string, lastName: string } => {
    const uid = seed || crypto.randomUUID();
    const idx = hash('animal:' + uid) % ANIMALS.length;
    const animal = ANIMALS[idx];

    return { firstName: animal, lastName: 'User' };
};
