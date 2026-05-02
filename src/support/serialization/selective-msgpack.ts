import { Readable } from 'node:stream';
import { buffer as collectStreamBuffer } from 'node:stream/consumers';
import { Unpackr, UnpackrStream } from 'msgpackr';
import type { Options as MsgpackDecoderOptions } from 'msgpackr';
import type { MsgpackObject, MsgpackValue } from '@/support/serialization/msgpack-value';
import mergeChunkedValue from '@/core/reverse-channel/application/merge-chunked-value';
import { isPlainObject } from '@/support/type-guards/is-record';

type ChunkLike = Uint8Array | Buffer;

/**
 * Streams msgpack values off an async iterable of byte chunks. Delegates the
 * frame/incomplete bookkeeping to `msgpackr.UnpackrStream` (a Node Transform
 * wrapping `Unpackr.unpackMultiple`).
 */
export async function* decodeMultiStream(
    src: AsyncIterable<ChunkLike> | Iterable<ChunkLike>,
    options?: MsgpackDecoderOptions
): AsyncIterable<MsgpackValue> {
    const unpacker = new UnpackrStream({ mapsAsObjects: true, ...(options ?? {}) } as MsgpackDecoderOptions);
    const source = Readable.from(src as AsyncIterable<ChunkLike>);
    source.on('error', (err) => unpacker.destroy(err));
    source.pipe(unpacker);

    for await (const value of unpacker as AsyncIterable<MsgpackValue>) {
        yield value;
    }
}

// Why: UnpackrStream re-attempts the parse as each Readable chunk lands and
// scales catastrophically on large single-message buffers (~78× slower than
// bulk on a 13 MB plugin output). Use this when the whole payload already
// fits in memory — Unpackr.unpackMultiple decodes every concatenated value in
// one pass and returns them as an array.
export function decodeMultiBuffer(
    buffer: Buffer | Uint8Array,
    options?: MsgpackDecoderOptions
): MsgpackValue[] {
    const unpacker = new Unpackr({ mapsAsObjects: true, ...(options ?? {}) } as MsgpackDecoderOptions);
    const view = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    return unpacker.unpackMultiple(view) as MsgpackValue[];
}

// Drains an async byte source (typically a zstd-decompressed MinIO response)
// into a Buffer, then decodes via `decodeMultiBuffer`. Trades streaming-friendly
// memory usage for ~100× lower CPU on plugin output sizes (single-digit MB).
export async function decodeMultiAsyncIterable(
    src: AsyncIterable<ChunkLike> | Iterable<ChunkLike> | NodeJS.ReadableStream,
    options?: MsgpackDecoderOptions
): Promise<MsgpackValue[]> {
    const readable = src instanceof Readable
        ? src
        : Readable.from(src as AsyncIterable<ChunkLike>);
    const buf = await collectStreamBuffer(readable);
    return decodeMultiBuffer(buf, options);
}

export const mergeSelectiveChunk = (
    target: MsgpackObject | null,
    incoming: MsgpackValue,
    keyFilter: (key: string) => boolean
): MsgpackObject | null => {
    if (!isPlainObject(incoming)) {
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

    const merged = mergeChunkedValue(target as unknown as Parameters<typeof mergeChunkedValue>[0], filtered as unknown as Parameters<typeof mergeChunkedValue>[1]);
    return isPlainObject(merged as MsgpackValue) ? (merged as MsgpackObject) : target;
};
