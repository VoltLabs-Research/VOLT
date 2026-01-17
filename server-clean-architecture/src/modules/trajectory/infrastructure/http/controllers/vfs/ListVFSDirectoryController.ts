import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { ListVFSDirectoryUseCase } from '../../../../application/use-cases/vfs/ListVFSDirectoryUseCase';

@injectable()
export default class ListVFSDirectoryController extends BaseController<ListVFSDirectoryUseCase> {
    constructor(
        @inject(ListVFSDirectoryUseCase) useCase: ListVFSDirectoryUseCase
    ) {
        super(useCase);
    }
}
