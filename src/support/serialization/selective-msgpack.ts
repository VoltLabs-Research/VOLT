import type { MsgpackObject, MsgpackValue } from '@/support/serialization/msgpack-value';
import mergeChunkedValue from '@/core/reverse-channel/application/merge-chunked-value';
import { Unpackr } from 'msgpackr';
import type { Options as MsgpackDecoderOptions } from 'msgpackr';

type ChunkLike = Uint8Array | Buffer;

interface MsgpackIncompleteError extends Error {
    incomplete?: boolean;
    lastPosition?: number;
    values?: MsgpackValue[];
}

const isMsgpackObject = (value: MsgpackValue): value is MsgpackObject => {
    return typeof value === 'object' && value !== null && !(value instanceof Array) && !(value instanceof Uint8Array);
};

const toBuffer = (chunk: ChunkLike): Buffer => {
    if (Buffer.isBuffer(chunk)) {
        return chunk;
    }

    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
};

const isMsgpackIncompleteError = (error: Error): error is MsgpackIncompleteError => {
    return 'incomplete' in error && error.incomplete === true;
};

export async function* decodeMultiStream(
    src: AsyncIterable<ChunkLike> | Iterable<ChunkLike>,
    options?: MsgpackDecoderOptions
): AsyncIterable<MsgpackValue> {
    const unpackr = new Unpackr({
        mapsAsObjects: true,
        ...options
    });
    let incomplete: Buffer | null = null;

    for await (const incomingChunk of src as AsyncIterable<ChunkLike> & Iterable<ChunkLike>) {
        const chunk = toBuffer(incomingChunk);
        if (chunk.length === 0) {
            continue;
        }

        const source = incomplete ? Buffer.concat([incomplete, chunk]) : chunk;

        try {
            const values = unpackr.unpackMultiple(source) as MsgpackValue[] | undefined;
            incomplete = null;

            if (!values) {
                continue;
            }

            for (const value of values) {
                yield value;
            }
        } catch (error) {
            if (!(error instanceof Error) || !isMsgpackIncompleteError(error)) {
                throw error;
            }

            if (error.values) {
                for (const value of error.values) {
                    yield value;
                }
            }

            const lastPosition = typeof error.lastPosition === 'number' ? error.lastPosition : 0;
            incomplete = source.subarray(lastPosition);
        }
    }

    if (!incomplete || incomplete.length === 0) {
        return;
    }

    const values = unpackr.unpackMultiple(incomplete) as MsgpackValue[] | undefined;
    if (!values) {
        return;
    }

    for (const value of values) {
        yield value;
    }
}

export const mergeSelectiveChunk = (
    target: MsgpackObject | null,
    incoming: MsgpackValue,
    keyFilter: (key: string) => boolean
): MsgpackObject | null => {
    if (!isMsgpackObject(incoming)) {
        return target;
    }

    const filtered: MsgpackObject = {};
    for (const [key, incomingValue] of Object.entries(incoming)) {
        if (keyFilter(key)) {
            filtered[key] = incomingValue;
        }
    }

    if (Object.keys(filtered).length === 0) {
        return target;
    }

    const merged = mergeChunkedValue(target, filtered);
    return isMsgpackObject(merged) ? merged : target;
};
