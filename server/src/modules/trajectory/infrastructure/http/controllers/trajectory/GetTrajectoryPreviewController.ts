import { injectable, inject } from 'tsyringe';
import { Request, Response, NextFunction } from 'express';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IStorageService } from '@shared/domain/ports/IStorageService';
import { SYS_BUCKETS } from '@core/config/minio';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';

@injectable()
export default class GetTrajectoryPreviewController {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ){}

    public handle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { trajectoryId } = req.params;

            if (!trajectoryId) {
                return BaseResponse.error(res, 'Trajectory ID is required', 400);
            }

            const prefix = `trajectory-${trajectoryId}/previews/`;

            // Find the first available preview PNG
            for await (const key of this.storageService.listByPrefix(SYS_BUCKETS.RASTERIZER, prefix)) {
                if (key.endsWith('.png')) {
                    try {
                        const buffer = await this.storageService.getBuffer(SYS_BUCKETS.RASTERIZER, key);
                        const etag = `"trajectory-preview-${trajectoryId}"`;
                        const base64 = `data:image/png;base64,${buffer.toString('base64')}`;

                        res.setHeader('Cache-Control', 'public, max-age=86400');
                        res.setHeader('ETag', etag);
                        return BaseResponse.success(res, base64);
                    } catch (error) {
                        // Continue to next preview if this one fails
                        continue;
                    }
                }
            }

            return BaseResponse.error(res, 'No preview available for this trajectory', 404);
        } catch (error) {
            next(error);
        }
    };
}
