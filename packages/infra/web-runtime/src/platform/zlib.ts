// Node's `zlib`: browserify-zlib's deflate/inflate family (pako), with the `constants` object Node
// groups their numbers under, the compression modes included (code reads its handle's modes there).
// Its zstd is decompression, in JavaScript (fzstd): what a daemon here unpacks plugin bundles with,
// whose sha256 it verifies first; fzstd does not check a frame's own checksum, as libzstd does.
// Compressing with zstd is the zstd program's work on this platform (the daemon's vendor/zstd), as
// it is for the daemon's stored dumps; zlib's zstd compression reports itself unavailable.
import zlib from 'browserify-zlib';
import binding from 'browserify-zlib/lib/binding';
import { Decompress, decompress } from 'fzstd';
import { Transform, type TransformCallback } from 'stream';
import { ownBuffer } from './own-buffer';

const numbersOf = (source: object, pattern: RegExp): Record<string, number> => Object.fromEntries(
    Object.entries(source).filter((entry): entry is [string, number] => pattern.test(entry[0]) && typeof entry[1] === 'number')
);

export const constants = {
    ...numbersOf(zlib, /^Z_/),
    ...numbersOf(binding, /^[A-Z]+$/)
};

class ZstdDecompress extends Transform {
    private readonly decoder = new Decompress((chunk) => {
        if(chunk.length > 0){
            this.push(ownBuffer(chunk));
        }
    });

    override _transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback): void {
        this.decode(chunk, false, done);
    }

    override _flush(done: TransformCallback): void {
        this.decode(new Uint8Array(0), true, done);
    }

    private decode(chunk: Uint8Array, final: boolean, done: TransformCallback): void {
        try{
            this.decoder.push(chunk, final);
            done();
        }catch(error){
            done(Object.assign(error as Error, { code: 'ZSTD_error_corruption_detected' }));
        }
    }
}

const zstdDecompressSync = (data: ArrayBufferView): Buffer =>
    ownBuffer(decompress(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)));

const zstdCompressionUnavailable = (): never => {
    throw Object.assign(new Error('zstd compression is not available on this platform'), { code: 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM' });
};

const zstd = {
    createZstdDecompress: (): Transform => new ZstdDecompress(),
    zstdDecompressSync,
    zstdDecompress: (data: ArrayBufferView, ...rest: unknown[]): void => {
        const callback = rest.at(-1) as (error: Error | null, result?: Buffer) => void;
        queueMicrotask(() => {
            let result: Buffer;
            try{
                result = zstdDecompressSync(data);
            }catch(error){
                callback(error as Error);
                return;
            }
            callback(null, result);
        });
    },
    createZstdCompress: zstdCompressionUnavailable,
    zstdCompressSync: zstdCompressionUnavailable,
    zstdCompress: zstdCompressionUnavailable
};

export default { ...zlib, ...zstd, constants };
