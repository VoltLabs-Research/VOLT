import path from 'node:path';
import { ObjectBucketName } from '@shared/contracts/types/http-object-store';
import { DAEMON_PATHS } from '@core/config/paths';
import { createScopedClusterObjectStore } from '@shared/infrastructure/storage/ClusterObjectStore';
import { type ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import { uploadBufferToObjectStore } from '@shared/infrastructure/storage/upload-buffer-to-object-store';

const GLB_TEMP_DIRECTORY = path.join(DAEMON_PATHS.analysisOutput, 'glb-export');

/**
 * Uploads an in-memory GLB to the models bucket. A `.zst` object key means the buffer
 * is already zstd-compressed, so the encoding headers must advertise it.
 */
export const uploadGlbBuffer = (
    objectStore: ClusterObjectStore,
    buffer: Buffer,
    objectKey: string,
    ownerClusterId: string
): Promise<void> => {
    const isZstdCompressed = objectKey.endsWith('.zst');
    return uploadBufferToObjectStore({
        objectStore: createScopedClusterObjectStore(objectStore, ownerClusterId),
        bucket: ObjectBucketName.Models,
        objectKey,
        buffer,
        contentType: 'model/gltf-binary',
        contentEncoding: isZstdCompressed ? 'zstd' : undefined,
        compressionCodec: isZstdCompressed ? 'zstd' : undefined,
        tempDirectory: GLB_TEMP_DIRECTORY,
        tempFilePrefix: 'volt-glb-export',
        tempFileSuffix: '.glb'
    });
};
