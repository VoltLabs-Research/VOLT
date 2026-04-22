// Why: small self-contained IEEE CRC32 (matches PNG/zip/zstd's "check"). Used for
// per-chunk and whole-file integrity checks in the .vtr footer/index.

const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index++) {
        let crc = index;
        for (let bit = 0; bit < 8; bit++) {
            crc = (crc & 1) !== 0 ? 0xEDB88320 ^ (crc >>> 1) : crc >>> 1;
        }
        table[index] = crc >>> 0;
    }
    return table;
})();

export const crc32 = (data: Uint8Array, seed = 0): number => {
    let crc = (~seed) >>> 0;
    for (let index = 0; index < data.length; index++) {
        crc = CRC32_TABLE[(crc ^ data[index]) & 0xFF] ^ (crc >>> 8);
    }
    return (~crc) >>> 0;
};

export const crc32Combine = (seed: number, data: Uint8Array): number => {
    let crc = (~seed) >>> 0;
    for (let index = 0; index < data.length; index++) {
        crc = CRC32_TABLE[(crc ^ data[index]) & 0xFF] ^ (crc >>> 8);
    }
    return (~crc) >>> 0;
};
