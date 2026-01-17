import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@/src/shared/domain/ports/IStorageService';
import { SYS_BUCKETS } from '@/src/core/minio';

@injectable()
export default class GetTrajectoryGLBController {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) { }

    public handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { trajectoryId, timestep } = req.params;
            const objectName = `trajectory-${trajectoryId}/timestep-${timestep}.glb`;
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
    };
}
