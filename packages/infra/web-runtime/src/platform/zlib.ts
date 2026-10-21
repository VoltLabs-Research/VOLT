// Node's `zlib`: browserify-zlib's deflate/inflate family (pako), with the `constants` object Node
// groups their numbers under, the compression modes included (code reads its handle's modes there).
import zlib from 'browserify-zlib';
import binding from 'browserify-zlib/lib/binding';

const numbersOf = (source: object, pattern: RegExp): Record<string, number> => Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, number] => pattern.test(entry[0]) && typeof entry[1] === 'number')
);

export const constants = {
    ...numbersOf(zlib, /^Z_/),
    ...numbersOf(binding, /^[A-Z]+$/)
};

export default { ...zlib, constants };
