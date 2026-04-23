import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import type { VtrRemoteSource } from '@/modules/trajectory/infrastructure/codecs/vtr-reader';
import type { Readable } from 'node:stream';

const streamToUint8Array = async (stream: Readable): Promise<Uint8Array> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const combined = Buffer.concat(chunks);
    return new Uint8Array(combined.buffer, combined.byteOffset, combined.byteLength);
};

export interface BuildRemoteSourceInput {
    objectStore: ClusterObjectStore;
    ownerClusterId: string;
    bucket: string;
    objectKey: string;
}

export const buildVtrRemoteSource = ({
    objectStore,
    ownerClusterId,
    bucket,
    objectKey
}: BuildRemoteSourceInput): VtrRemoteSource => {
    return {
        kind: 'remote',
        ownerClusterId,
        bucket,
        objectKey,
        fetchRange: async (offset, length) => {
            const response = await objectStore.getStream(ownerClusterId, bucket, objectKey, {
                skipMetadata: true,
                range: { offset, length }
            });
            const buf = await streamToUint8Array(response.stream);
            // Why: when the VoltCloud reverse tunnel strips the HTTP Range header
            // we still receive the full object. Slice client-side so the VTR
            // reader gets exactly the requested bytes. If the upstream honored
            // the range (buf.length === length) this is a no-op.
            if (buf.length === length) return buf;
            if (buf.length >= offset + length) return buf.subarray(offset, offset + length);
            // Partial but smaller than expected — return what we have, reader
            // will surface the mismatch as a proper decode error.
            return buf;
        },
        fetchFull: async () => {
            const response = await objectStore.getStream(ownerClusterId, bucket, objectKey, {
                skipMetadata: true
            });
            return streamToUint8Array(response.stream);
        }
    };
};
