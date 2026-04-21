import { Decoder } from '@msgpack/msgpack';
import type { DecoderOptions } from '@msgpack/msgpack';

type ChunkLike = Uint8Array | Buffer;
type MsgpackDecoderOptions = DecoderOptions<unknown>;
type ChunkStream = AsyncIterable<ChunkLike>;

export async function* decodeMultiStream(
    src: AsyncIterable<ChunkLike>,
    options?: MsgpackDecoderOptions
): AsyncIterable<unknown> {
    const decoder = new Decoder<unknown>(options);
    for await (const value of decoder.decodeStream(src as ChunkStream)) {
        yield value;
    }
};
