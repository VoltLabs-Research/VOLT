import { injectable, inject } from 'tsyringe';
import { Response, Request, NextFunction } from 'express';
import slugify from '@shared/infrastructure/utilities/slugify';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import { SYS_BUCKETS } from '@core/config/minio';

@injectable()
export default class GetPluginExposureGLBController{
    constructor(
       @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ){}

    public handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const { trajectoryId, analysisId, exposureId, timestep } = req.params;
        const objectName = `trajectory-${trajectoryId}/analysis-${analysisId}/glb/${timestep}/${slugify(exposureId as string)}.glb`;
        const [stat, stream] = await Promise.all([
            this.storageService.getStat(SYS_BUCKETS.MODELS, objectName), 
            this.storageService.getStream(SYS_BUCKETS.MODELS, objectName)
        ]);

        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Content-Disposition', `inline; filename="${objectName}"`);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        stream.pipe(res);
    }
}

