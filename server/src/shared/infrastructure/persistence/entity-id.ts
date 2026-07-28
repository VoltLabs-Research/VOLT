import { randomBytes } from 'node:crypto';

const PROCESS_SEED = randomBytes(5);
const COUNTER_CEILING = 0xffffff;

let counter = randomBytes(3).readUIntBE(0, 3);

const nextCounter = (): number => {
    counter = (counter + 1) % (COUNTER_CEILING + 1);
    return counter;
};

export const ENTITY_ID_LENGTH = 24;

export const generateEntityId = (): string => {
    const buffer = Buffer.allocUnsafe(12);
    buffer.writeUInt32BE(Math.floor(Date.now() / 1000), 0);
    PROCESS_SEED.copy(buffer, 4);
    buffer.writeUIntBE(nextCounter(), 9, 3);
    return buffer.toString('hex');
};

export const isEntityId = (value: unknown): value is string => (
    typeof value === 'string' && /^[0-9a-f]{24}$/.test(value)
);
