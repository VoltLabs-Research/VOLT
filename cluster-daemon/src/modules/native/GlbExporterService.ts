import { ObjectBucketName } from '../../contracts/http';
import { DAEMON_TOKENS } from '../../core/tokens';
import { MinioService } from '../../infrastructure/minio/MinioService';
import { NativeModuleLoader, type NativeTrajectoryRequest } from './NativeModuleLoader';
import { RasterizerService } from './RasterizerService';
import { TrajectoryParserService } from './TrajectoryParserService';
import { inject, injectable } from 'tsyringe';
import fs from 'node:fs/promises';

@injectable()
export class GlbExporterService {
    constructor(
        @inject(DAEMON_TOKENS.MinioService)
        private readonly minioService: MinioService,
        @inject(DAEMON_TOKENS.NativeModuleLoader)
        private readonly nativeModuleLoader: NativeModuleLoader,
        @inject(DAEMON_TOKENS.TrajectoryParserService)
        private readonly trajectoryParserService: TrajectoryParserService,
        @inject(DAEMON_TOKENS.RasterizerService)
        private readonly rasterizerService: RasterizerService
    ) {
    }

    async preprocessTrajectory(input: NativeTrajectoryRequest): Promise<void> {
        await this.trajectoryParserService.withDumpFile(input, async (dumpPath) => {
            const parsed = this.trajectoryParserService.parseTrajectory(dumpPath);
            const tempGlbPath = `${dumpPath}.glb`;
            const tempPngPath = `${dumpPath}.png`;
            const modelObjectKey = this.trajectoryParserService.getModelObjectKey(input.trajectoryId, input.timestep);
            const previewObjectKey = this.trajectoryParserService.getPreviewObjectKey(input.trajectoryId, input.timestep);

            try {
                const exported = this.nativeModuleLoader.getExporterModule().generateGLBToFile(
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
                await this.minioService.putObject({
                    bucket: ObjectBucketName.Models,
                    objectKey: modelObjectKey,
                    body: glbBuffer,
                    metadata: {
                        'Content-Type': 'model/gltf-binary'
                    }
                });

                await this.rasterizerService.rasterizeLocalGlb(tempGlbPath, tempPngPath);

                const pngBuffer = await fs.readFile(tempPngPath);
                await this.minioService.putObject({
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
};
