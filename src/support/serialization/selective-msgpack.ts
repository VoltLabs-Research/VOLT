import { Decoder } from '@msgpack/msgpack';
import type { DecoderOptions } from '@msgpack/msgpack';
import { isRecord } from '@/support/type-guards/isRecord';
import mergeChunkedValue from '@/core/reverse-channel/application/merge-chunked-value';

type ChunkLike = Uint8Array | Buffer;
type MsgpackDecoderOptions = DecoderOptions<unknown>;

export async function* decodeMultiStream(
    src: AsyncIterable<ChunkLike>,
    options?: MsgpackDecoderOptions
): AsyncIterable<unknown> {
    const decoder = new Decoder<unknown>(options);
    const byteSrc = (async function* () {
        for await (const chunk of src) {
            yield chunk;
        }
    })();

    for await (const value of decoder.decodeStream(byteSrc)) {
        yield value;
    }
}

export const mergeSelectiveChunk = (
    target: Record<string, unknown> | null,
    incoming: unknown,
    keyFilter: (key: string) => boolean
): Record<string, unknown> | null => {
    if (!isRecord(incoming)) {
        return target;
    }

    const filtered: Record<string, unknown> = {};
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
