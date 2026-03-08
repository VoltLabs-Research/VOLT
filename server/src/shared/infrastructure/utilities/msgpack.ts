import { createReadStream } from 'node:fs';
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
    const byteSrc: ChunkStream = (async function* () {
        for await (const chunk of src) {
            yield chunk;
        }
    })();

    for await (const value of decoder.decodeStream(byteSrc)) {
        yield value;
    }
};

export async function* decodeMultiStreamFromFile(
    filePath: string,
    options?: MsgpackDecoderOptions
): AsyncIterable<unknown> {
    const stream = createReadStream(filePath);
    const src = (async function* (): AsyncIterable<ChunkLike> {
        for await (const chunk of stream) {
            yield chunk;
        }
    })();

    yield* decodeMultiStream(src, options);
}
