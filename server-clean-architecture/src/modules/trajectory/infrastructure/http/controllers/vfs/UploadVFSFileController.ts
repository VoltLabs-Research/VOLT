import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { UploadVFSFileUseCase } from '../../../../application/use-cases/vfs/UploadVFSFileUseCase';
import { AuthenticatedRequest } from '@/src/shared/infrastructure/http/middleware/authentication';
import { UploadVFSFileInputDTO } from '../../../../application/dtos/vfs/VFSDTOs';

@injectable()
export default class UploadVFSFileController extends BaseController<UploadVFSFileUseCase> {
    constructor(
        @inject(UploadVFSFileUseCase) useCase: UploadVFSFileUseCase
    ) {
        super(useCase);
    }

    protected getParams(req: AuthenticatedRequest): UploadVFSFileInputDTO {
        const file = (req as any).file;
        return {
            trajectoryId: req.params.trajectoryId as string,
            path: req.body.path || '',
            fileBuffer: file ? file.buffer : Buffer.from([])
        };
    }
}
