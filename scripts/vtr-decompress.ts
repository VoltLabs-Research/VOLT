import { readFileSync } from 'node:fs';
import { decodeVtrHeader, decodeFrameIndexEntry } from '@/modules/trajectory/infrastructure/codecs/vtr-header';
import { VTR_FRAME_INDEX_ENTRY_SIZE } from '@/modules/trajectory/contracts/vtr-format';
import { zstdDecode } from '@/modules/trajectory/infrastructure/codecs/vtr-zstd';

const vtrPath = process.argv[2];
const buf = readFileSync(vtrPath);
const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
const { header, frameIndexOffset } = decodeVtrHeader(data);

for (let i = 0; i < header.frameCount; i++) {
    const offset = frameIndexOffset + i * VTR_FRAME_INDEX_ENTRY_SIZE;
    const entry = decodeFrameIndexEntry(data, offset);
    const chunk = data.subarray(entry.offset, entry.offset + entry.compressedSize);
    console.log(`frame[${i}] t=${entry.timestep} chunk: [${entry.offset}..${entry.offset + entry.compressedSize}] len=${chunk.length}`);
    try {
        const decompressed = zstdDecode(chunk);
        console.log(`  decompressed ok: uSize=${decompressed.length} (expected=${entry.uncompressedSize})`);
    } catch (e) {
        console.error(`  FAILED:`, (e as Error).message);
    }
}
