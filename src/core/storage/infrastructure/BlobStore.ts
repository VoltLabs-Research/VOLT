import { Service } from '@/core/decorators/service';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { VTR_BLOB_BUCKET, VTR_BLOB_PREFIX } from '@/modules/trajectory/contracts/vtr-format';
import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';

// Why: content-addressed (F5.S3) FrameChunk blob dedup. Both Writer (put-if-absent)
// and Reader (range-fetch) go through this. GC hook is intentionally stubbed — a
// dedicated sweeper job collects unreferenced hashes in a later stream.

const HEX_ALPHABET = '0123456789abcdef';

const bytesToHex = (bytes: Uint8Array): string => {
    let out = '';
    for (let index = 0; index < bytes.length; index++) {
        const value = bytes[index];
        out += HEX_ALPHABET[(value >>> 4) & 0x0F];
        out += HEX_ALPHABET[value & 0x0F];
    }
    return out;
};

const hexToBytes = (hex: string): Uint8Array => {
    if (hex.length !== 64) {
        throw new Error(`invalid sha256 hex length: ${hex.length}`);
    }
    const out = new Uint8Array(32);
    for (let index = 0; index < 32; index++) {
        out[index] = parseInt(hex.substring(index * 2, index * 2 + 2), 16);
    }
    return out;
};

export interface BlobPutResult {
    hash: Uint8Array;
    hashHex: string;
    size: number;
    stored: boolean;
}

const buildBlobKey = (hashHex: string): string => {
    // Why: shard by two hex bytes to avoid a single "hot" prefix in MinIO's
    // listing path; keeps GC sweeps cheap.
    return `${VTR_BLOB_PREFIX}${hashHex.substring(0, 2)}/${hashHex.substring(2, 4)}/${hashHex}`;
};

const computeSha256 = (data: Uint8Array): Uint8Array => {
    const hasher = createHash('sha256');
    hasher.update(data);
    return new Uint8Array(hasher.digest());
};

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
};

@Service('blobStore')
export class BlobStore {
    public constructor(private readonly objectStore: ClusterObjectStore) {}

    public async put(ownerClusterId: string, data: Uint8Array): Promise<BlobPutResult> {
        const hash = computeSha256(data);
        const hashHex = bytesToHex(hash);
        const key = buildBlobKey(hashHex);

        try {
            await this.objectStore.head(ownerClusterId, VTR_BLOB_BUCKET, key);
            return { hash, hashHex, size: data.byteLength, stored: false };
        } catch {
            // Why: head throws on NotFound; we fall through and upload.
        }

        await this.objectStore.putObject({
            ownerClusterId,
            bucket: VTR_BLOB_BUCKET,
            objectKey: key,
            body: Buffer.from(data.buffer, data.byteOffset, data.byteLength),
            metadata: { 'Content-Type': 'application/octet-stream' }
        });

        return { hash, hashHex, size: data.byteLength, stored: true };
    }

    public async get(ownerClusterId: string, hash: Uint8Array | string): Promise<Uint8Array> {
        const hashHex = typeof hash === 'string' ? hash : bytesToHex(hash);
        const key = buildBlobKey(hashHex);
        const response = await this.objectStore.getStream(
            ownerClusterId,
            VTR_BLOB_BUCKET,
            key,
            { skipMetadata: true }
        );
        const buffer = await streamToBuffer(response.stream);
        return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    }

    public getBlobKey(hash: Uint8Array | string): string {
        const hashHex = typeof hash === 'string' ? hash : bytesToHex(hash);
        return buildBlobKey(hashHex);
    }

    public async exists(ownerClusterId: string, hash: Uint8Array | string): Promise<boolean> {
        const hashHex = typeof hash === 'string' ? hash : bytesToHex(hash);
        try {
            await this.objectStore.head(ownerClusterId, VTR_BLOB_BUCKET, buildBlobKey(hashHex));
            return true;
        } catch {
            return false;
        }
    }

    public hashHexToBytes(hashHex: string): Uint8Array {
        return hexToBytes(hashHex);
    }

    public bytesToHashHex(hash: Uint8Array): string {
        return bytesToHex(hash);
    }

    // Why: placeholder hook referenced by the plan's F5.S3 acceptance. Actual
    // sweep is executed by a separate job (out of this stream's scope).
    public async garbageCollect(_ownerClusterId: string): Promise<number> {
        return 0;
    }
}

export const buildBlobObjectKey = buildBlobKey;
export const sha256HexFromBytes = bytesToHex;
export const sha256BytesFromHex = hexToBytes;
