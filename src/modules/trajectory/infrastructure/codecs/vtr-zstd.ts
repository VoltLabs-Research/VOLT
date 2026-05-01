import { constants, zstdCompress, zstdCompressSync, zstdDecompress, zstdDecompressSync } from 'node:zlib';

const DEFAULT_LEVEL = 10;

interface ZstdParams {
    level?: number;
    dict?: Uint8Array;
}

interface ZstdEncodeOptions {
    params?: Record<number, number>;
    dictionary?: Uint8Array;
}

const toOptions = (params: ZstdParams): ZstdEncodeOptions => {
    const options: ZstdEncodeOptions = {};
    if (typeof params.level === 'number') {
        const compressionLevelKey = (constants as unknown as Record<string, number>).ZSTD_c_compressionLevel;
        if (typeof compressionLevelKey === 'number') {
            options.params = { [compressionLevelKey]: params.level };
        }
    }
    if (params.dict) {
        options.dictionary = params.dict;
    }
    return options;
};

const runZstdCompress = (data: Uint8Array, options: ZstdEncodeOptions): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        zstdCompress(data, options as Parameters<typeof zstdCompress>[1], (error, result) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(result);
        });
    });

const runZstdDecompress = (data: Uint8Array, options?: ZstdEncodeOptions): Promise<Buffer> =>
    new Promise((resolve, reject) => {
        const callback = (error: Error | null, result: Buffer) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(result);
        };

        if (options) {
            zstdDecompress(data, options as Parameters<typeof zstdDecompress>[1], callback);
            return;
        }

        zstdDecompress(data, callback);
    });

const toUint8Array = (buffer: Buffer): Uint8Array =>
    new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

export const zstdEncode = (data: Uint8Array, params: ZstdParams = {}): Uint8Array => {
    const options = toOptions({ level: params.level ?? DEFAULT_LEVEL, dict: params.dict });
    const buffer = zstdCompressSync(data, options as Parameters<typeof zstdCompressSync>[1]);
    return toUint8Array(buffer);
};

export const zstdEncodeAsync = async (data: Uint8Array, params: ZstdParams = {}): Promise<Uint8Array> => {
    const options = toOptions({ level: params.level ?? DEFAULT_LEVEL, dict: params.dict });
    const buffer = await runZstdCompress(data, options);
    return toUint8Array(buffer);
};

export const zstdDecode = (data: Uint8Array, params: { dict?: Uint8Array } = {}): Uint8Array => {
    const options = params.dict ? toOptions({ dict: params.dict }) : undefined;
    const buffer = options
        ? zstdDecompressSync(data, options as Parameters<typeof zstdDecompressSync>[1])
        : zstdDecompressSync(data);
    return toUint8Array(buffer);
};

export const zstdDecodeAsync = async (data: Uint8Array, params: { dict?: Uint8Array } = {}): Promise<Uint8Array> => {
    const options = params.dict ? toOptions({ dict: params.dict }) : undefined;
    const buffer = await runZstdDecompress(data, options);
    return toUint8Array(buffer);
};
