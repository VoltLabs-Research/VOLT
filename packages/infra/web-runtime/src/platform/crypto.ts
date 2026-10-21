// Node's `crypto`: crypto-browserify covers hashes, HMAC, ciphers and random bytes; this adds what it
// lacks and the backends call (randomUUID, timingSafeEqual, scrypt with Node's defaults).
import * as browserCrypto from 'crypto-browserify';
import { scrypt as nobleScrypt } from '@noble/hashes/scrypt';

interface ScryptOptions {
    N?: number;
    cost?: number;
    r?: number;
    blockSize?: number;
    p?: number;
    parallelization?: number;
    maxmem?: number;
}

type ScryptCallback = (error: Error | null, key?: Buffer) => void;

const toBytes = (value: string | Uint8Array): Uint8Array => typeof value === 'string' ? new TextEncoder().encode(value) : value;

const deriveScrypt = (password: string | Uint8Array, salt: string | Uint8Array, keylen: number, options: ScryptOptions = {}): Buffer => (
    Buffer.from(nobleScrypt(toBytes(password), toBytes(salt), {
        N: options.N ?? options.cost ?? 16_384,
        r: options.r ?? options.blockSize ?? 8,
        p: options.p ?? options.parallelization ?? 1,
        dkLen: keylen
    }))
);

export const scryptSync = deriveScrypt;

export const scrypt = (password: string | Uint8Array, salt: string | Uint8Array, keylen: number, optionsOrCallback: ScryptOptions | ScryptCallback, maybeCallback?: ScryptCallback): void => {
    const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
    const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback;
    queueMicrotask(() => {
        try{
            callback?.(null, deriveScrypt(password, salt, keylen, options));
        }catch(error){
            callback?.(error as Error);
        }
    });
};

export const randomUUID = (): string => globalThis.crypto.randomUUID();

export const timingSafeEqual = (left: Uint8Array, right: Uint8Array): boolean => {
    if(left.byteLength !== right.byteLength){
        throw Object.assign(new RangeError('Input buffers must have the same byte length'), { code: 'ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH' });
    }
    let difference = 0;
    for(let index = 0; index < left.byteLength; index += 1){
        difference |= left[index] ^ right[index];
    }
    return difference === 0;
};

export const getRandomValues = <T extends ArrayBufferView>(array: T): T => globalThis.crypto.getRandomValues(array as unknown as Uint8Array) as unknown as T;

export const webcrypto = globalThis.crypto;

export const subtle = globalThis.crypto.subtle;

export const {
    createHash,
    createHmac,
    createCipheriv,
    createDecipheriv,
    randomBytes,
    randomFillSync,
    randomFill,
    pbkdf2,
    pbkdf2Sync,
    createSign,
    createVerify,
    createDiffieHellman,
    createECDH,
    publicEncrypt,
    privateDecrypt,
    getHashes,
    getCiphers
} = browserCrypto;

export const randomInt = (minOrMax: number, maybeMax?: number): number => {
    const min = maybeMax === undefined ? 0 : minOrMax;
    const max = maybeMax === undefined ? minOrMax : maybeMax;
    const [value] = globalThis.crypto.getRandomValues(new Uint32Array(1));
    return min + (value % (max - min));
};

export default {
    ...browserCrypto,
    scrypt,
    scryptSync,
    randomUUID,
    randomInt,
    timingSafeEqual,
    getRandomValues,
    webcrypto,
    subtle
};
