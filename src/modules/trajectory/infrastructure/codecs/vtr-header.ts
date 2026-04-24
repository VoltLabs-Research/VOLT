import {
    VTR_FRAME_INDEX_ENTRY_SIZE,
    VTR_MAGIC_FOOTER,
    VTR_MAGIC_HEAD,
    VTR_VERSION,
    VTR_ZSTD_DICT_REF_SIZE,
    VtrChunkCodec,
    VtrColumnSchema,
    VtrDtype,
    VtrColumnSemantic,
    VtrFlag,
    VtrFrameIndexEntry,
    VtrFrameKind,
    VtrHeader,
    VtrTypeDictEntry,
    VtrZstdDictRef
} from '@/modules/trajectory/contracts/vtr-format';

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: false });

const toBytes = (value: string): Uint8Array => TEXT_ENCODER.encode(value);

const writeUtf8 = (view: DataView, offset: number, value: string): number => {
    const bytes = toBytes(value);
    view.setUint16(offset, bytes.length, true);
    new Uint8Array(view.buffer, view.byteOffset + offset + 2, bytes.length).set(bytes);
    return 2 + bytes.length;
};

const readUtf8 = (view: DataView, offset: number): { value: string; consumed: number } => {
    const length = view.getUint16(offset, true);
    const slice = new Uint8Array(view.buffer, view.byteOffset + offset + 2, length);
    return { value: TEXT_DECODER.decode(slice), consumed: 2 + length };
};

const measureHeaderSize = (
    typeDict: VtrTypeDictEntry[],
    columnSchema: VtrColumnSchema[]
): number => {
    let size = 0;
    size += VTR_MAGIC_HEAD.length;
    size += 4 + 4;
    size += 8 + 8;
    size += 6 * 4;
    size += 2;
    for (const entry of typeDict) {
        size += 2 + 2 + toBytes(entry.label).length;
    }
    size += 2;
    for (const column of columnSchema) {
        size += 2 + toBytes(column.name).length + 1 + 1 + 2;
    }
    size += 8 + 4 + VTR_ZSTD_DICT_REF_SIZE;
    return size;
};

export const encodeVtrHeader = (header: VtrHeader): Uint8Array => {
    const size = measureHeaderSize(header.typeDict, header.columnSchema);
    const buffer = new Uint8Array(size);
    const view = new DataView(buffer.buffer);
    let offset = 0;

    buffer.set(VTR_MAGIC_HEAD, offset);
    offset += VTR_MAGIC_HEAD.length;

    view.setUint32(offset, header.version, true);
    offset += 4;
    view.setUint32(offset, header.flags, true);
    offset += 4;

    view.setBigUint64(offset, BigInt(header.frameCount), true);
    offset += 8;
    view.setBigUint64(offset, BigInt(header.atomMax), true);
    offset += 8;

    for (let index = 0; index < 6; index++) {
        view.setFloat32(offset, header.bbox[index], true);
        offset += 4;
    }

    view.setUint16(offset, header.typeDict.length, true);
    offset += 2;
    for (const entry of header.typeDict) {
        view.setUint16(offset, entry.typeId, true);
        offset += 2;
        offset += writeUtf8(view, offset, entry.label);
    }

    view.setUint16(offset, header.columnSchema.length, true);
    offset += 2;
    for (const column of header.columnSchema) {
        offset += writeUtf8(view, offset, column.name);
        view.setUint8(offset, column.dtype);
        offset += 1;
        view.setUint8(offset, column.semantic);
        offset += 1;
        view.setUint16(offset, 0, true);
        offset += 2;
    }

    const zstdKey = header.zstdDict?.key ?? '';
    const zstdSize = header.zstdDict?.size ?? 0;
    const zstdKeyBytes = toBytes(zstdKey);
    if (zstdKeyBytes.length > VTR_ZSTD_DICT_REF_SIZE) {
        throw new Error(`Zstd dict key exceeds ${VTR_ZSTD_DICT_REF_SIZE} bytes: ${zstdKey}`);
    }
    view.setBigUint64(offset, 0n, true); // offset placeholder, blobs are external
    offset += 8;
    view.setUint32(offset, zstdSize, true);
    offset += 4;
    buffer.fill(0, offset, offset + VTR_ZSTD_DICT_REF_SIZE);
    buffer.set(zstdKeyBytes, offset);
    offset += VTR_ZSTD_DICT_REF_SIZE;

    if (offset !== size) {
        throw new Error(`vtr header size mismatch: expected=${size} actual=${offset}`);
    }

    return buffer;
};

interface DecodedVtrHeader {
    header: VtrHeader;
    headerBytes: number;
    frameIndexOffset: number;
}

export const decodeVtrHeader = (data: Uint8Array): DecodedVtrHeader => {
    if (data.byteLength < VTR_MAGIC_HEAD.length + 4) {
        throw new Error('vtr header too small');
    }
    for (let index = 0; index < VTR_MAGIC_HEAD.length; index++) {
        if (data[index] !== VTR_MAGIC_HEAD[index]) {
            throw new Error('vtr magic mismatch');
        }
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = VTR_MAGIC_HEAD.length;

    const version = view.getUint32(offset, true);
    offset += 4;
    if (version !== VTR_VERSION) {
        throw new Error(`vtr version mismatch: file=${version} supported=${VTR_VERSION}`);
    }
    const flags = view.getUint32(offset, true);
    offset += 4;

    const frameCount = Number(view.getBigUint64(offset, true));
    offset += 8;
    const atomMax = Number(view.getBigUint64(offset, true));
    offset += 8;

    const bbox: [number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0];
    for (let index = 0; index < 6; index++) {
        bbox[index] = view.getFloat32(offset, true);
        offset += 4;
    }

    const typeDictCount = view.getUint16(offset, true);
    offset += 2;
    const typeDict: VtrTypeDictEntry[] = [];
    for (let index = 0; index < typeDictCount; index++) {
        const typeId = view.getUint16(offset, true);
        offset += 2;
        const { value, consumed } = readUtf8(view, offset);
        offset += consumed;
        typeDict.push({ typeId, label: value });
    }

    const columnCount = view.getUint16(offset, true);
    offset += 2;
    const columnSchema: VtrColumnSchema[] = [];
    for (let index = 0; index < columnCount; index++) {
        const { value, consumed } = readUtf8(view, offset);
        offset += consumed;
        const dtype = view.getUint8(offset) as VtrDtype;
        offset += 1;
        const semantic = view.getUint8(offset) as VtrColumnSemantic;
        offset += 1;
        offset += 2; // reserved
        columnSchema.push({ name: value, dtype, semantic });
    }

    const zstdDictPlaceholderOffset = view.getBigUint64(offset, true);
    void zstdDictPlaceholderOffset;
    offset += 8;
    const zstdDictSize = view.getUint32(offset, true);
    offset += 4;
    const keyBytes = new Uint8Array(data.buffer, data.byteOffset + offset, VTR_ZSTD_DICT_REF_SIZE);
    offset += VTR_ZSTD_DICT_REF_SIZE;
    const zeroIndex = keyBytes.indexOf(0);
    const keyEnd = zeroIndex === -1 ? keyBytes.length : zeroIndex;
    const zstdDictKey = keyEnd === 0 ? '' : TEXT_DECODER.decode(keyBytes.subarray(0, keyEnd));

    const zstdDict: VtrZstdDictRef | null = (flags & VtrFlag.HasZstdDict) !== 0 && zstdDictKey.length > 0
        ? { key: zstdDictKey, size: zstdDictSize }
        : null;

    const frameIndexOffset = offset;

    return {
        header: {
            version,
            flags,
            frameCount,
            atomMax,
            bbox,
            typeDict,
            columnSchema,
            zstdDict,
            frameIndexOffset
        },
        headerBytes: offset,
        frameIndexOffset
    };
};

export const encodeFrameIndexEntry = (entry: VtrFrameIndexEntry): Uint8Array => {
    const buffer = new Uint8Array(VTR_FRAME_INDEX_ENTRY_SIZE);
    const view = new DataView(buffer.buffer);
    view.setBigUint64(0, BigInt(entry.offset), true);
    view.setUint32(8, entry.compressedSize, true);
    view.setUint32(12, entry.uncompressedSize, true);
    view.setUint32(16, entry.atomCount, true);
    view.setBigUint64(20, BigInt(entry.timestep), true);
    view.setUint8(28, entry.frameKind);
    view.setUint8(29, entry.chunkCodecId);
    view.setUint16(30, 0, true);
    view.setUint32(32, entry.keyframeIndex, true);
    view.setUint32(36, entry.crc32, true);
    view.setBigUint64(40, 0n, true);
    return buffer;
};

export const decodeFrameIndexEntry = (data: Uint8Array, baseOffset: number): VtrFrameIndexEntry => {
    const view = new DataView(data.buffer, data.byteOffset + baseOffset, VTR_FRAME_INDEX_ENTRY_SIZE);
    const offset = Number(view.getBigUint64(0, true));
    const compressedSize = view.getUint32(8, true);
    const uncompressedSize = view.getUint32(12, true);
    const atomCount = view.getUint32(16, true);
    const timestep = Number(view.getBigUint64(20, true));
    const frameKind = view.getUint8(28) as VtrFrameKind;
    const chunkCodecId = view.getUint8(29) as VtrChunkCodec;
    const keyframeIndex = view.getUint32(32, true);
    const crc32 = view.getUint32(36, true);
    return {
        offset,
        compressedSize,
        uncompressedSize,
        atomCount,
        timestep,
        frameKind,
        chunkCodecId,
        keyframeIndex,
        crc32
    };
};

export const encodeFooter = (crc32: number): Uint8Array => {
    const buffer = new Uint8Array(4 + VTR_MAGIC_FOOTER.length);
    const view = new DataView(buffer.buffer);
    view.setUint32(0, crc32, true);
    buffer.set(VTR_MAGIC_FOOTER, 4);
    return buffer;
};

