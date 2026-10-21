import path from 'node:path';
import { DAEMON_PATHS } from '@core/config/paths';
import { createScopedClusterObjectStore } from '@shared/storage/ClusterObjectStore';
import { type ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import { uploadBufferToObjectStore } from '@shared/storage/upload-buffer-to-object-store';
import { TEAM_CLUSTER_OBJECT_STORE_BUCKET } from '@voltstack/daemon-cluster-client';

const GLB_TEMP_DIRECTORY = path.join(DAEMON_PATHS.analysisOutput, 'glb-export');

export const uploadGlbBuffer = (
    objectStore: ClusterObjectStore,
    buffer: Buffer,
    objectKey: string,
    ownerClusterId: string
): Promise<void> => {
    const isZstdCompressed = objectKey.endsWith('.zst');
    return uploadBufferToObjectStore({
        objectStore: createScopedClusterObjectStore(objectStore, ownerClusterId),
        bucket: TEAM_CLUSTER_OBJECT_STORE_BUCKET.Models,
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
