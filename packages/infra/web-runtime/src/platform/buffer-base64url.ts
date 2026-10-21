// Node's base64url encoding, which the npm Buffer (feross/buffer) predates: base64 with the URL-safe
// alphabet and no padding. Its base64 decoder already reads that alphabet unpadded, so only the
// encoding's name and the encoder change. Every bundle's Buffer is this one module, patched once.
import { Buffer } from 'buffer';

const isBase64url = (encoding: unknown): boolean => typeof encoding === 'string' && encoding.toLowerCase() === 'base64url';

const toBase64url = (text: string): string => text.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// The arguments with a base64url encoding named as base64, wherever the signature puts it.
const asBase64 = (args: unknown[]): unknown[] => args.map((arg) => (isBase64url(arg) ? 'base64' : arg));

type Patched = Record<string, (...args: unknown[]) => unknown>;
const statics = Buffer as unknown as Patched;
const methods = Buffer.prototype as unknown as Patched;

for(const name of ['from', 'byteLength', 'alloc']){
    const original = statics[name];
    statics[name] = function(this: unknown, ...args: unknown[]){
        return original.apply(this, asBase64(args));
    };
}

const isEncoding = statics.isEncoding;
statics.isEncoding = (encoding: unknown) => isBase64url(encoding) || isEncoding(encoding);

for(const name of ['write', 'fill', 'includes', 'indexOf', 'lastIndexOf']){
    const original = methods[name];
    methods[name] = function(this: unknown, ...args: unknown[]){
        return original.apply(this, asBase64(args));
    };
}

// Read by name: Patched's index signature does not override Object's own toString type.
const toString = methods['toString'] as (...args: unknown[]) => unknown;
methods['toString'] = function(this: unknown, ...args: unknown[]){
    return isBase64url(args[0]) ? toBase64url(toString.apply(this, asBase64(args)) as string) : toString.apply(this, args);
};
