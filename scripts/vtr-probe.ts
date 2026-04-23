import { readFileSync } from 'node:fs';
import { decodeVtrHeader, decodeFrameIndexEntry } from '@/modules/trajectory/infrastructure/codecs/vtr-header';
import { VTR_FRAME_INDEX_ENTRY_SIZE } from '@/modules/trajectory/contracts/vtr-format';

const vtrPath = process.argv[2];
if (!vtrPath) { console.error('usage: vtr-probe.ts <path>'); process.exit(1); }
const buf = readFileSync(vtrPath);
const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
console.log(`file size: ${data.length}`);

const { header, headerBytes, frameIndexOffset } = decodeVtrHeader(data);
console.log(`headerBytes=${headerBytes} frameIndexOffset=${frameIndexOffset}`);
console.log(`frameCount=${header.frameCount} atomMax=${header.atomMax} bbox=${header.bbox}`);
console.log(`columnSchema=${JSON.stringify(header.columnSchema)}`);
console.log(`typeDict=${JSON.stringify(header.typeDict)}`);
console.log(`zstdDict=${JSON.stringify(header.zstdDict)}`);
console.log(`flags=0x${header.flags.toString(16)}`);

for (let i = 0; i < header.frameCount; i++) {
    const offset = frameIndexOffset + i * VTR_FRAME_INDEX_ENTRY_SIZE;
    const entry = decodeFrameIndexEntry(data, offset);
    console.log(`\nframe[${i}] timestep=${entry.timestep} offset=${entry.offset} cSize=${entry.compressedSize} uSize=${entry.uncompressedSize} atoms=${entry.atomCount} kind=${entry.frameKind} codec=${entry.chunkCodecId} keyref=${entry.keyframeIndex}`);
    const bytes = data.subarray(entry.offset, Math.min(entry.offset + 16, entry.offset + entry.compressedSize));
    console.log(`  first16bytes=${Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join(' ')}`);
    if (bytes[0] === 0x28 && bytes[1] === 0xb5 && bytes[2] === 0x2f && bytes[3] === 0xfd) {
        console.log('  -> ZSTD magic OK');
    } else if (bytes[0] === 0x01) {
        console.log(`  -> looks like envelope (v1), flag byte = 0x${bytes[3].toString(16)}`);
    } else {
        console.log('  -> UNKNOWN prefix');
    }
}
