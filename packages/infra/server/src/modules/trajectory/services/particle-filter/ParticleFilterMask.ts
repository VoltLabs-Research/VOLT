import { ParticleFilterCombinator } from '@volt/contracts/modules/trajectory/http';

const toU32View = (mask: Uint8Array, wordCount: number): Uint32Array => {
    if ((mask.byteOffset % Uint32Array.BYTES_PER_ELEMENT) === 0) {
        return new Uint32Array(mask.buffer, mask.byteOffset, wordCount);
    }
    const aligned = new Uint8Array(mask.byteLength);
    aligned.set(mask);
    return new Uint32Array(aligned.buffer, 0, wordCount);
};

export const combineMasks = (
    leftMask: Uint8Array,
    rightMask: Uint8Array,
    combinator: ParticleFilterCombinator
): Uint8Array => {
    const length = leftMask.length;
    const combinedMask = new Uint8Array(length);
    const wordCount = length >>> 2;
    const tailStart = wordCount << 2;
    const isOr = combinator === ParticleFilterCombinator.Or;

    const alignedLeft = toU32View(leftMask, wordCount);
    const alignedRight = toU32View(rightMask, wordCount);
    const alignedOut = toU32View(combinedMask, wordCount);

    if (isOr) {
        for (let word = 0; word < wordCount; word++) {
            alignedOut[word] = alignedLeft[word] | alignedRight[word];
        }
    } else {
        for (let word = 0; word < wordCount; word++) {
            alignedOut[word] = alignedLeft[word] & alignedRight[word];
        }
    }

    if (isOr) {
        for (let index = tailStart; index < length; index++) {
            combinedMask[index] = leftMask[index] | rightMask[index];
        }
    } else {
        for (let index = tailStart; index < length; index++) {
            combinedMask[index] = leftMask[index] & rightMask[index];
        }
    }

    return combinedMask;
};

export const countMatches = (mask: Uint8Array): number => {
    const length = mask.length;
    let count = 0;
    for (let index = 0; index < length; index++) {
        count += mask[index];
    }
    return count;
};
