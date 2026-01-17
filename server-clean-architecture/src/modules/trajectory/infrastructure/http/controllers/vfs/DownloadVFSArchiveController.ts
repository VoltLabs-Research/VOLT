import { injectable, inject } from 'tsyringe';
import { Response } from 'express';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { DownloadVFSArchiveUseCase } from '../../../../application/use-cases/vfs/DownloadVFSArchiveUseCase';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import BaseResponse from '@/src/shared/infrastructure/http/BaseResponse';
import { HttpStatus } from '@/src/shared/infrastructure/http/HttpStatus';

@injectable()
export default class DownloadVFSArchiveController extends BaseController<DownloadVFSArchiveUseCase> {
    constructor(
        @inject(DownloadVFSArchiveUseCase) useCase: DownloadVFSArchiveUseCase
    ) {
        super(useCase);
    }

    public handle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            // Override because useCase requires string, not obj from getParams
            const result = await this.useCase.execute(req.params.trajectoryId as string);

            if (!result.success) {
                return BaseResponse.error(
                    res,
                    result.error.message,
                    (result.error as any).statusCode || HttpStatus.InternalServerError
                );
            }

            const { stream, fileName } = result.value;

            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

            stream.pipe(res);
        } catch (error) {
            console.error(error);
            return BaseResponse.error(res, 'Internal Server Error', HttpStatus.InternalServerError);
        }
    };
}
