import { createReadStream } from 'node:fs';
import type { Readable } from 'node:stream';
import { Decoder, type DecoderOptions } from '@msgpack/msgpack';

type ChunkLike = Uint8Array | Buffer;
type MsgpackDecoderOptions = DecoderOptions<unknown>;

export async function* decodeMultiStream(
    src: AsyncIterable<ChunkLike>,
    options?: MsgpackDecoderOptions
): AsyncIterable<unknown> {
    const decoder = new Decoder<unknown>(options);
    const byteSrc = (async function* () {
        for await (const chunk of src) {
            yield chunk as Uint8Array;
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
    const stream = createReadStream(filePath) as unknown as Readable & AsyncIterable<Uint8Array>;
    const src = (async function* (): AsyncIterable<ChunkLike> {
        for await (const chunk of stream) {
            yield chunk as Uint8Array;
        }
    })();

    yield* decodeMultiStream(src, options);
}
