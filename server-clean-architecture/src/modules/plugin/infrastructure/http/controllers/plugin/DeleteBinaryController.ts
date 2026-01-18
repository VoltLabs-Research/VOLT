import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { DeleteBinaryUseCase } from '@modules/plugin/application/use-cases/plugin/DeleteBinaryUseCase';

@injectable()
export default class DeleteBinaryController extends BaseController<DeleteBinaryUseCase> {
    constructor(
        @inject(DeleteBinaryUseCase) useCase: DeleteBinaryUseCase
    ) {
        super(useCase);
    }
}
