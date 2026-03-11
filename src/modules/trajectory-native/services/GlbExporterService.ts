import { ObjectBucketName } from '@/shared/contracts';
import {
    NativeModuleOperation
} from './NativeModuleLoader';
import fs from 'node:fs/promises';
import type { MinioService } from '@/modules/platform/services';
import type { NativeModuleLoader, NativeTrajectoryRequest } from './NativeModuleLoader';
import type { RasterizerService } from './RasterizerService';
import type { TrajectoryParserService } from './TrajectoryParserService';

export interface GlbExporterService {
    preprocessTrajectory(input: NativeTrajectoryRequest): Promise<void>;
};

export const createGlbExporterService = (
    minioService: MinioService,
    nativeModuleLoader: NativeModuleLoader,
    trajectoryParserService: TrajectoryParserService,
    rasterizerService: RasterizerService
): GlbExporterService => ({
    async preprocessTrajectory(input) {
        nativeModuleLoader.traceOperation(NativeModuleOperation.ExportGlb, {
            objectKey: input.objectKey,
            timestep: input.timestep,
            trajectoryId: input.trajectoryId
        });
        await trajectoryParserService.withDumpFile(input, async (dumpPath) => {
            const parsed = trajectoryParserService.parseTrajectory(dumpPath);
            const tempGlbPath = `${dumpPath}.glb`;
            const tempPngPath = `${dumpPath}.png`;
            const modelObjectKey = trajectoryParserService.getModelObjectKey(input.trajectoryId, input.timestep);
            const previewObjectKey = trajectoryParserService.getPreviewObjectKey(input.trajectoryId, input.timestep);

            try {
                const exported = nativeModuleLoader.getExporterModule().generateGLBToFile(
                    parsed.positions,
                    parsed.types,
                    parsed.min,
                    parsed.max,
                    tempGlbPath
                );
                if (!exported) {
                    throw new Error('Failed to export trajectory GLB');
                }

                const glbBuffer = await fs.readFile(tempGlbPath);
                await minioService.putObject({
                    bucket: ObjectBucketName.Models,
                    objectKey: modelObjectKey,
                    body: glbBuffer,
                    metadata: {
                        'Content-Type': 'model/gltf-binary'
                    }
                });

                await rasterizerService.rasterizeLocalGlb(tempGlbPath, tempPngPath);

                const pngBuffer = await fs.readFile(tempPngPath);
                await minioService.putObject({
                    bucket: ObjectBucketName.Rasterizer,
                    objectKey: previewObjectKey,
                    body: pngBuffer,
                    metadata: {
                        'Content-Type': 'image/png',
                        'Cache-Control': 'public, max-age=86400'
                    }
                });
            } finally {
                await Promise.all([
                    fs.unlink(tempGlbPath).catch(() => {}),
                    fs.unlink(tempPngPath).catch(() => {})
                ]);
            }
        });
    }
});
