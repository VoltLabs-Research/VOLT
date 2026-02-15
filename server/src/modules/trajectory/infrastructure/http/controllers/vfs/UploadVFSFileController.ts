import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { UploadVFSFileUseCase } from '@modules/trajectory/application/use-cases/vfs/UploadVFSFileUseCase';

@injectable()
export default class UploadVFSFileController extends BaseController<UploadVFSFileUseCase> {
    constructor(
        @inject(UploadVFSFileUseCase) useCase: UploadVFSFileUseCase
    ) {
        super(useCase);
    }
}
