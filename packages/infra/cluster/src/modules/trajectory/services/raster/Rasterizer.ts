import { singleton } from '@shared/utilities/singleton';
import { getObjectStore } from '@shared/storage/ClusterObjectStore';
import { withNativeProcessingTempDir } from '@shared/utilities/native-temp-dir';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buffer } from 'node:stream/consumers';
import type { ClusterObjectStore } from '@shared/contracts/types/cluster-object-store';
import { decompressModel } from '@shared/storage/model-objects';
import headlessRasterizer from '@voltstack/headless-rasterizer';
import spatialAssembler from '@voltstack/spatial-assembler';
import { TEAM_CLUSTER_OBJECT_STORE_BUCKET } from '@voltstack/daemon-cluster-client';

const TRAJECTORY_PREVIEW_WIDTH = 3840;
const TRAJECTORY_PREVIEW_HEIGHT = 2160;

interface RasterizePreviewInput {
    inputBucket: string;
    inputObjectKey: string;
    inputOwnerClusterId?: string;
    outputObjectKey: string;
    outputOwnerClusterId?: string;
}

export class Rasterizer {
    constructor(
        private readonly objectStore: ClusterObjectStore
    ) {}

    async rasterizePreview(input: RasterizePreviewInput): Promise<void> {
        const { inputOwnerClusterId, outputOwnerClusterId } = input;
        if (!inputOwnerClusterId || !outputOwnerClusterId) {
            throw new Error('Rasterization requires inputOwnerClusterId and outputOwnerClusterId');
        }

        const response = await this.objectStore.getStream(inputOwnerClusterId, input.inputBucket, input.inputObjectKey, {
            skipMetadata: true
        });
        const [points] = spatialAssembler.decodeGLB(await decompressModel(await buffer(response.stream)));
        if (!points) {
            throw new Error(`Model ${input.inputObjectKey} has nothing to rasterize`);
        }

        await withNativeProcessingTempDir('trajectory-rasterize', async (tempDirectory) => {
            const pngPath = path.join(tempDirectory, 'output.png');
            const rasterized = headlessRasterizer.rasterizePoints(
                points.positions,
                points.colors,
                pngPath,
                TRAJECTORY_PREVIEW_WIDTH,
                TRAJECTORY_PREVIEW_HEIGHT,
                45,
                25,
                {
                    fov: 45,
                    distScale: 1,
                    zUp: true
                }
            );
            if (!rasterized) {
                throw new Error('Failed to rasterize trajectory preview');
            }

            const pngStat = await fs.stat(pngPath);
            await this.objectStore.putObjectStream({
                ownerClusterId: outputOwnerClusterId,
                bucket: TEAM_CLUSTER_OBJECT_STORE_BUCKET.Rasterizer,
                objectKey: input.outputObjectKey,
                stream: createReadStream(pngPath),
                size: pngStat.size,
                metadata: {
                    'Content-Type': 'image/png',
                    'Cache-Control': 'public, max-age=86400'
                }
            });
        });
    }
}

export const getRasterizer = singleton((): Rasterizer => new Rasterizer(getObjectStore()));
