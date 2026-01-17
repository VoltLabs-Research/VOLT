import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { DeleteVFSFileUseCase } from '../../../../application/use-cases/vfs/DeleteVFSFileUseCase';

@injectable()
export default class DeleteVFSFileController extends BaseController<DeleteVFSFileUseCase> {
    constructor(
        @inject(DeleteVFSFileUseCase) useCase: DeleteVFSFileUseCase
    ) {
        super(useCase);
    }
}
