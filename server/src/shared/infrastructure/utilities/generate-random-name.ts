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

const ADJECTIVES = [
    'Swift',
    'Bright',
    'Calm',
    'Clever',
    'Bold',
    'Noble',
    'Vivid',
    'Gentle',
    'Agile',
    'Cosmic',
    'Fearless',
    'Lucky',
    'Silent',
    'Tiny',
    'Mighty',
    'Golden',
    'Crystal',
    'Lunar',
    'Solar',
    'Arctic',
];

interface GenerateRandomNameResult{
    firstName: string;
    lastName: string;
};

const hash = (str: string): number => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
};

const generateRandomName = (seed?: string): GenerateRandomNameResult => {
    const uid = seed || crypto.randomUUID();
    const animalIndex = hash('animal:' + uid) % ANIMALS.length;
    const adjectiveIndex = hash('adjective:' + uid) % ADJECTIVES.length;

    return {
        firstName: ADJECTIVES[adjectiveIndex],
        lastName: ANIMALS[animalIndex]
    };
};

export default generateRandomName;