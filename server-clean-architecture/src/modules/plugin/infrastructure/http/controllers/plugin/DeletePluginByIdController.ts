import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { DeletePluginByIdUseCase } from '../../../../application/use-cases/plugin/DeletePluginByIdUseCase';

@injectable()
export default class DeletePluginByIdController extends BaseController<DeletePluginByIdUseCase> {
    constructor(
        @inject(DeletePluginByIdUseCase) useCase: DeletePluginByIdUseCase
    ) {
        super(useCase);
    }
}
