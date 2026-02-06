import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { DeletePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/DeletePluginByIdUseCase';

@injectable()
export default class DeletePluginByIdController extends BaseController<DeletePluginByIdUseCase> {
    constructor(
        @inject(DeletePluginByIdUseCase) useCase: DeletePluginByIdUseCase
    ) {
        super(useCase);
    }
}
