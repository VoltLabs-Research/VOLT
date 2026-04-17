import { isRecord } from '@/support/type-guards/isRecord';
import type { MsgpackObject, MsgpackValue } from '@/support/serialization/msgpack-value';
import mergeChunkedValue from '@/core/reverse-channel/application/merge-chunked-value';
import { Unpackr, type Options as MsgpackDecoderOptions } from 'msgpackr';

type ChunkLike = Uint8Array | Buffer;

interface MsgpackIncompleteError extends Error {
    incomplete?: boolean;
    lastPosition?: number;
    values?: unknown[];
}

const toBuffer = (chunk: ChunkLike): Buffer => {
    if (Buffer.isBuffer(chunk)) {
        return chunk;
    }

    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
};

const isMsgpackIncompleteError = (error: unknown): error is MsgpackIncompleteError => {
    return error instanceof Error && 'incomplete' in error && (error as MsgpackIncompleteError).incomplete === true;
};

export const decodeMultiStream = (
    src: AsyncIterable<ChunkLike> | Iterable<ChunkLike>,
    options?: MsgpackDecoderOptions
): AsyncIterable<MsgpackValue> => {
    return (async function* decodeChunks(): AsyncIterable<MsgpackValue> {
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
                const values = unpackr.unpackMultiple(source) ?? [];
                incomplete = null;

                for (const value of values) {
                    yield value as MsgpackValue;
                }
            } catch (error) {
                if (!isMsgpackIncompleteError(error)) {
                    throw error;
                }

                for (const value of error.values ?? []) {
                    yield value as MsgpackValue;
                }

                const lastPosition = typeof error.lastPosition === 'number' ? error.lastPosition : 0;
                incomplete = source.subarray(lastPosition);
            }
        }

        if (!incomplete || incomplete.length === 0) {
            return;
        }

        const values = unpackr.unpackMultiple(incomplete) ?? [];
        for (const value of values) {
            yield value as MsgpackValue;
        }
    })();
};

export const mergeSelectiveChunk = (
    target: MsgpackObject | null,
    incoming: MsgpackValue,
    keyFilter: (key: string) => boolean
): MsgpackObject | null => {
    if (!isRecord(incoming)) {
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
    return isRecord(merged) ? merged : target;
};
