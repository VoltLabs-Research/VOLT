import { injectable, inject } from 'tsyringe';
import { Response, Request, NextFunction } from 'express';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import { SYS_BUCKETS } from '@core/config/minio';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ISceneArtifactRepository } from '@modules/trajectory/domain/port/ISceneArtifactRepository';
import { RuntimeError } from '@core/exceptions/RuntimeError';
import { ErrorCodes } from '@core/constants/error-codes';

@injectable()
export default class GetPluginExposureGLBController{
    constructor(
       @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private readonly sceneArtifactRepository: ISceneArtifactRepository
    ){}

    public handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { trajectoryId, analysisId, exposureId, timestep } = req.params;

            const artifact = await this.sceneArtifactRepository.findOne({
                trajectory: String(trajectoryId),
                analysis: String(analysisId),
                sourceType: 'plugin-exposure',
                timestep: Number(timestep),
                params: {
                    exposureId: String(exposureId)
                }
            } as any);

            if (!artifact) {
                throw new RuntimeError(ErrorCodes.COLOR_CODING_DUMP_NOT_FOUND, 404);
            }

            const objectName = artifact.props.objectName;
            const [stat, stream] = await Promise.all([
                this.storageService.getStat(SYS_BUCKETS.MODELS, objectName), 
                this.storageService.getStream(SYS_BUCKETS.MODELS, objectName)
            ]);

            res.setHeader('Content-Type', 'model/gltf-binary');
            res.setHeader('Content-Length', stat.size);
            res.setHeader('Content-Disposition', `inline; filename="${objectName}"`);
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            stream.pipe(res);
        } catch (error) {
            next(error);
        }
    }
}

