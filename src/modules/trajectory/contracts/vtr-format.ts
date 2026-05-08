// Why: canonical binary layout for the .vtr trajectory file. Shared between
// daemon writer/reader and any other consumer. All offsets are little-endian.
//
//   [Magic "VTR\0"]                                 4 B
//   [u32 version]                                   4 B
//   [u32 flags]                                     4 B
//   [u64 frameCount]                                8 B
//   [u64 atomMax]                                   8 B
//   [f32[6] globalBbox (minX,minY,minZ,maxX,maxY,maxZ)]   24 B
//   [u16 typeDictCount][TypeDictEntry * count]
//   [u16 columnSchemaCount][ColumnSchemaEntry * count]
//   [u64 zstdDictOffset][u32 zstdDictSize][u8[32] zstdDictRef (cluster blob key, 0-padded UTF-8)]
//   [FrameIndex: frameCount * FrameIndexEntry (48 B)]
//   [...FrameChunks (contiguous, pointed to by FrameIndex)]
//   [Footer: u32 crc32][Magic "VTREND"]
//
// FrameIndexEntry (48 B):
//   [u64 offset]                                    8 B
//   [u32 compressedSize]                            4 B
//   [u32 uncompressedSize]                          4 B
//   [u32 atomCount]                                 4 B
//   [u64 timestep]                                  8 B
//   [u8 frameKind]  (0 = I keyframe, 1 = P delta)   1 B
//   [u8 chunkCodecId]                               1 B
//   [u8 reserved[2]]                                2 B
//   [u32 keyframeIndex (index into FrameIndex, or 0xFFFFFFFF if self)]  4 B
//   [u32 crc32 (of compressed chunk)]               4 B
//   [u64 reserved]                                  8 B
//
// ColumnSchemaEntry:
//   [u16 nameLen][name: UTF-8 bytes][u8 dtype][u8 semantics][u8 reserved[2]]
//
// TypeDictEntry:
//   [u16 typeId][u16 labelLen][label: UTF-8 bytes]
//
// FrameChunk (compressed with zstd, optionally using dict):
//   [u8 chunkVersion=1]
//   [u8 codecId]                        mirrors FrameIndexEntry.chunkCodecId
//   [u8 frameKind]                      mirrors FrameIndexEntry.frameKind
//   [u8 flags]                          bit 0 = dedup reference
//   [u16 columnCount]
//   [f32[6] frameBbox]                  (used by int16_norm decoder)
//   [Column * columnCount]
//
// Column:
//   [u16 nameLen][name: UTF-8]
//   [u8 dtype]
//   [u8 encoding]
//   [u16 reserved]
//   [u32 byteLen]
//   [...byteLen bytes...]
//
// Dedup mode (flags bit 0 set):
//   [Blob reference payload: u8[32] sha256 + u32 blobSize], no columns inline.

export const VTR_MAGIC_HEAD: Uint8Array = new Uint8Array([0x56, 0x54, 0x52, 0x00]);
export const VTR_MAGIC_FOOTER: Uint8Array = new Uint8Array([0x56, 0x54, 0x52, 0x45, 0x4E, 0x44]);
export const VTR_VERSION = 1;

export enum VtrFlag {
    HasTypeDict = 1 << 0,
    HasZstdDict = 1 << 1,
    Lossless = 1 << 2,
    UseDelta = 1 << 3,
    UseDedup = 1 << 4,
    UseMortonOrder = 1 << 5
}

export enum VtrDtype {
    Float32 = 0x01,
    Float64 = 0x02,
    Uint8 = 0x03,
    Uint16 = 0x04,
    Uint32 = 0x05,
    Int8 = 0x06,
    Int16 = 0x07,
    Int32 = 0x08,
    PositionsF32 = 0x10,
    PositionsInt16Norm = 0x11,
    IdsU32 = 0x12,
    TypesU16 = 0x13,
    CustomF32 = 0x14,
    CustomU32 = 0x15,
    DeltaInt8 = 0x20,
    DeltaInt16 = 0x21
}

export enum VtrColumnEncoding {
    Raw = 0x00,
    Delta = 0x01,
    QuantizedInt16 = 0x02
}

export enum VtrColumnSemantic {
    Position = 0x01,
    Type = 0x02,
    Id = 0x03,
    Custom = 0x04
}

export enum VtrFrameKind {
    Independent = 0,
    Predictive = 1
}

export enum VtrChunkCodec {
    ZstdPlain = 0x01,
    ZstdDict = 0x02
}

export const VTR_FRAME_INDEX_ENTRY_SIZE = 48;
export const VTR_ZSTD_DICT_REF_SIZE = 32;
export const VTR_SHA256_SIZE = 32;
export const VTR_CHUNK_FLAG_DEDUP = 1 << 0;
export const VTR_DEDUP_PAYLOAD_SIZE = VTR_SHA256_SIZE + 4;

export const VTR_BLOB_BUCKET = 'volt-vtr-blobs';
export const VTR_DICT_BUCKET = 'volt-vtr-dict';
export const VTR_BLOB_PREFIX = 'blobs/';

export const DEFAULT_KEYFRAME_INTERVAL = 50;

export interface VtrColumnSchema {
    name: string;
    dtype: VtrDtype;
    semantic: VtrColumnSemantic;
}

export interface VtrTypeDictEntry {
    typeId: number;
    label: string;
}

export interface VtrZstdDictRef {
    key: string;
    size: number;
}

export interface VtrHeader {
    version: number;
    flags: number;
    frameCount: number;
    atomMax: number;
    bbox: readonly [number, number, number, number, number, number];
    typeDict: VtrTypeDictEntry[];
    columnSchema: VtrColumnSchema[];
    zstdDict: VtrZstdDictRef | null;
    frameIndexOffset: number;
}

export interface VtrFrameIndexEntry {
    offset: number;
    compressedSize: number;
    uncompressedSize: number;
    atomCount: number;
    timestep: number;
    frameKind: VtrFrameKind;
    chunkCodecId: VtrChunkCodec;
    keyframeIndex: number;
    crc32: number;
}

export const VTR_KEYFRAME_NONE = 0xFFFFFFFF;

export interface VtrColumnData {
    name: string;
    dtype: VtrDtype;
    encoding: VtrColumnEncoding;
    data: Uint8Array;
    bbox?: readonly [number, number, number, number, number, number];
}

export interface VtrFrameChunkBody {
    frameKind: VtrFrameKind;
    flags: number;
    frameBbox: readonly [number, number, number, number, number, number];
    columns: VtrColumnData[];
    dedupRef?: { hash: Uint8Array; size: number };
}
