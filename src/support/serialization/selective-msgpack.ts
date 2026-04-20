import { Readable } from 'node:stream';
import { UnpackrStream } from 'msgpackr';
import type { Options as MsgpackDecoderOptions } from 'msgpackr';
import type { MsgpackObject, MsgpackValue } from '@/support/serialization/msgpack-value';
import mergeChunkedValue from '@/core/reverse-channel/application/merge-chunked-value';

type ChunkLike = Uint8Array | Buffer;

const isMsgpackObject = (value: MsgpackValue): value is MsgpackObject =>
    typeof value === 'object' && value !== null && !(value instanceof Array) && !(value instanceof Uint8Array);

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

    const merged = mergeChunkedValue(target as unknown as Parameters<typeof mergeChunkedValue>[0], filtered as unknown as Parameters<typeof mergeChunkedValue>[1]);
    return isMsgpackObject(merged as MsgpackValue) ? (merged as MsgpackObject) : target;
};
