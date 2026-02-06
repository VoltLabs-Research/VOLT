import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { ListVFSDirectoryUseCase } from '@modules/trajectory/application/use-cases/vfs/ListVFSDirectoryUseCase';

@injectable()
export default class ListVFSDirectoryController extends BaseController<ListVFSDirectoryUseCase> {
    constructor(
        @inject(ListVFSDirectoryUseCase) useCase: ListVFSDirectoryUseCase
    ) {
        super(useCase);
    }
}
