// Writes a wheel (https://packaging.python.org/specifications/binary-distribution-format/) of a
// pure-Python package: a zip archive of its files and its .dist-info, whose RECORD lists every file
// with its digest. Entries carry a fixed date, so the same files make the same wheel.
import { createHash } from 'node:crypto';
import { crc32, deflateRawSync } from 'node:zlib';

// 1980-01-01, the earliest date a zip entry can carry.
const DOS_DATE = (1 << 5) | 1;
// Names are UTF-8.
const UTF8_NAMES = 0x0800;
const DEFLATE = 8;
const ZIP_VERSION = 20;
// Made on Unix, so that the external attributes are its file modes.
const MADE_BY_UNIX = (3 << 8) | ZIP_VERSION;
const REGULAR_FILE = 0o100644;

const zip = (entries) => {
    const records = [];
    const directory = [];
    let offset = 0;
    for(const { name, data } of entries){
        const encodedName = Buffer.from(name);
        const compressed = deflateRawSync(data);
        const checksum = crc32(data);
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(ZIP_VERSION, 4);
        local.writeUInt16LE(UTF8_NAMES, 6);
        local.writeUInt16LE(DEFLATE, 8);
        local.writeUInt16LE(0, 10);
        local.writeUInt16LE(DOS_DATE, 12);
        local.writeUInt32LE(checksum, 14);
        local.writeUInt32LE(compressed.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(encodedName.length, 26);
        local.writeUInt16LE(0, 28);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(MADE_BY_UNIX, 4);
        central.writeUInt16LE(ZIP_VERSION, 6);
        central.writeUInt16LE(UTF8_NAMES, 8);
        central.writeUInt16LE(DEFLATE, 10);
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(DOS_DATE, 14);
        central.writeUInt32LE(checksum, 16);
        central.writeUInt32LE(compressed.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(encodedName.length, 28);
        central.writeUInt32LE(REGULAR_FILE * 0x10000, 38);
        central.writeUInt32LE(offset, 42);
        records.push(local, encodedName, compressed);
        directory.push(central, encodedName);
        offset += local.length + encodedName.length + compressed.length;
    }
    const directorySize = directory.reduce((size, part) => size + part.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(directorySize, 12);
    end.writeUInt32LE(offset, 16);
    return Buffer.concat([...records, ...directory, end]);
};

const recordDigest = (data) => `sha256=${createHash('sha256').update(data).digest('base64url')}`;

// The wheel of `files` ({ path in the wheel: contents }) as the distribution `name` at `version`,
// with the core metadata `metadata` ([field, value] pairs, which may repeat a field): its file name
// and contents.
export const buildWheel = ({ name, version, metadata, files }) => {
    const distInfo = `${name}-${version}.dist-info`;
    const text = (lines) => Buffer.from(lines.map((line) => `${line}\n`).join(''));
    const entries = [
        ...Object.entries(files).map(([file, data]) => ({ name: file, data: Buffer.from(data) })),
        { name: `${distInfo}/METADATA`, data: text([`Metadata-Version: 2.1`, `Name: ${name}`, `Version: ${version}`, ...metadata.map(([field, value]) => `${field}: ${value}`)]) },
        { name: `${distInfo}/WHEEL`, data: text(['Wheel-Version: 1.0', 'Generator: @volt/web-runtime', 'Root-Is-Purelib: true', 'Tag: py3-none-any']) }
    ];
    const record = text([
        ...entries.map((entry) => `${entry.name},${recordDigest(entry.data)},${entry.data.length}`),
        `${distInfo}/RECORD,,`
    ]);
    entries.push({ name: `${distInfo}/RECORD`, data: record });
    return { filename: `${name}-${version}-py3-none-any.whl`, data: zip(entries) };
};
