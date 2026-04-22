import { constants, zstdCompressSync, zstdDecompressSync } from 'node:zlib';

// Why: node:zlib exposes synchronous zstd bindings. We use them on already-sized
// in-memory chunks (one per frame). No spawn.

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

export const zstdEncode = (data: Uint8Array, params: ZstdParams = {}): Uint8Array => {
    const options = toOptions({ level: params.level ?? DEFAULT_LEVEL, dict: params.dict });
    const buffer = zstdCompressSync(data, options as Parameters<typeof zstdCompressSync>[1]);
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
};

export const zstdDecode = (data: Uint8Array, params: { dict?: Uint8Array } = {}): Uint8Array => {
    const options = params.dict ? toOptions({ dict: params.dict }) : undefined;
    const buffer = options
        ? zstdDecompressSync(data, options as Parameters<typeof zstdDecompressSync>[1])
        : zstdDecompressSync(data);
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
};
